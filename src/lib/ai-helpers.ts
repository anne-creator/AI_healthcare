import { z } from "zod";
import { prisma } from "@/lib/db";
import type { PatientContext } from "@/types";

// ---------------------------------------------------------------------------
// Zod schema — structured output for AI scoring
// ---------------------------------------------------------------------------

export const ScoringResultSchema = z.object({
  severityScore: z
    .number()
    .min(0)
    .max(100)
    .describe("0–100 urgency score for this patient RIGHT NOW"),
  confidenceScore: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "0–100 confidence in the severity score based on data richness"
    ),
  contradictions: z
    .array(
      z.object({
        severity: z.enum(["CRITICAL", "HIGH", "MODERATE"]),
        title: z.string().describe("Short label, e.g. 'Metformin + Elevated Creatinine'"),
        description: z.string().describe("Clinical explanation of the risk"),
        drug: z.string().describe("The drug involved"),
        labOrDiagnosis: z
          .string()
          .describe("The lab value or diagnosis code that creates the contradiction"),
        action: z.string().describe("Recommended clinical action"),
      })
    )
    .describe("Drug-lab and drug-disease contradictions detected"),
  summary: z
    .string()
    .describe(
      "One concise paragraph summarizing this patient's clinical picture, suitable for display on a queue card"
    ),
  recommendedActions: z
    .array(z.string())
    .describe("Ordered list of recommended clinical actions"),
});

export type ScoringResultOutput = z.infer<typeof ScoringResultSchema>;

// ---------------------------------------------------------------------------
// Fetch full clinical context for a patient from the DB
// ---------------------------------------------------------------------------

export async function fetchPatientContext(
  hadmId: number
): Promise<PatientContext | null> {
  const clinicalCase = await prisma.clinicalCase.findUnique({
    where: { hadmId },
    include: {
      labs: {
        include: { labInfo: true },
        orderBy: { charttime: "desc" },
        take: 50,
      },
      prescriptions: {
        orderBy: { startdate: "desc" },
      },
      diagnoses: {
        include: { diagInfo: true },
        orderBy: { seqNum: "asc" },
      },
    },
  });

  if (!clinicalCase) return null;

  const priorAdmissions = await prisma.clinicalCase.findMany({
    where: {
      subjectId: clinicalCase.subjectId,
      hadmId: { not: hadmId },
    },
    select: {
      hadmId: true,
      admissionDiagnosis: true,
      age: true,
    },
  });

  return {
    hadmId: clinicalCase.hadmId,
    subjectId: clinicalCase.subjectId,
    age: clinicalCase.age,
    gender: clinicalCase.gender,
    admissionDiagnosis: clinicalCase.admissionDiagnosis,
    labs: clinicalCase.labs.map((l) => ({
      labName: l.labInfo.labName,
      fluid: l.labInfo.fluid,
      category: l.labInfo.category,
      charttime: l.charttime.toISOString(),
      value: l.value,
      unit: l.unit,
    })),
    prescriptions: clinicalCase.prescriptions.map((p) => ({
      drug: p.drug,
      doseValue: p.doseValue,
      doseUnit: p.doseUnit,
      route: p.route,
      startdate: p.startdate?.toISOString() ?? null,
      enddate: p.enddate?.toISOString() ?? null,
    })),
    diagnoses: clinicalCase.diagnoses.map((d) => ({
      seqNum: d.seqNum,
      icd9Code: d.icd9Code,
      shortTitle: d.diagInfo.shortTitle,
      longTitle: d.diagInfo.longTitle,
    })),
    priorAdmissions,
  };
}

// ---------------------------------------------------------------------------
// RL preference injection — few-shot examples from doctor overrides
// ---------------------------------------------------------------------------

export async function fetchRLPreferences(): Promise<string> {
  const feedback = await prisma.scoringFeedback.findMany({
    where: { note: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      patient: {
        include: { case: true },
      },
    },
  });

  if (feedback.length === 0) return "";

  const examples = feedback.map((f) => {
    const direction =
      f.adjustedRank < f.originalRank ? "elevated priority" : "lowered priority";
    return `- Patient (${f.patient.case.admissionDiagnosis}): doctor ${direction} from #${f.originalRank} to #${f.adjustedRank}. Reason: "${f.note}"`;
  });

  return `
## Doctor Override History (weight these preferences in your scoring)
The following are recent corrections by doctors. Adjust your scoring to reflect these clinical preferences:
${examples.join("\n")}
`;
}

// ---------------------------------------------------------------------------
// System prompt — clinical scoring instructions with contradiction rules
// ---------------------------------------------------------------------------

export function buildScoringSystemPrompt(rlPreferences: string): string {
  return `You are a clinical triage AI for an emergency room. Your job is to score patient urgency and detect drug-lab/drug-disease contradictions from their medical history.

## Severity Score (0–100): How urgent is this patient RIGHT NOW

Scoring rubric:
- Critical ICD-9 codes (MI 410.x, sepsis 038.x/995.91, respiratory failure 518.81, stroke 434.x, 436): +50 base
- CHF (428.x), stroke history: +35 base
- Pneumonia (486), COPD (496): +20 base
- Diabetes (250.x): +10 base
- Each drug-disease/drug-lab contradiction: +10 (max +20 from contradictions)
- Critical lab values: creatinine > 3.0 (+15), K+ < 2.5 or > 6.5 (+15), INR > 3.5 (+15)
- Multiple prior admissions for same condition: +5

## Confidence Score (0–100): How certain are you about the severity

Based on data richness:
- Rich data (many labs, multiple prescriptions, clear diagnoses): 80–100
- Moderate data: 50–79
- Sparse data (few labs, unclear picture): 20–49
- Very sparse (< 5 labs, no prescriptions): 0–19

## Contradiction Detection Rules (CHECK ALL 6)

You MUST check every prescription against every lab value and diagnosis:

1. **Metformin + Creatinine > 1.5 mg/dL** → CRITICAL — lactic acidosis risk. Action: "Hold metformin, monitor renal function"
2. **Metformin + CKD diagnosis (ICD 585.x)** → HIGH — contraindicated in chronic kidney disease. Action: "Review metformin continuation with nephrology"
3. **ACE inhibitor (enalapril, lisinopril, ramipril, captopril, benazepril, fosinopril, quinapril, perindopril) + Potassium > 5.5 mEq/L** → CRITICAL — hyperkalemia risk. Action: "Hold ACE inhibitor, check potassium urgently"
4. **Warfarin + INR > 3.5** → CRITICAL — supratherapeutic anticoagulation, bleeding risk. Action: "Hold warfarin, consider vitamin K"
5. **NSAID (ibuprofen, naproxen, diclofenac, ketorolac, indomethacin, celecoxib, aspirin >325mg) + CKD (ICD 585.x)** → HIGH — worsens renal function. Action: "Discontinue NSAID, use alternative analgesic"
6. **NSAID + CHF (ICD 428.x)** → MODERATE — causes fluid retention. Action: "Avoid NSAID, consider acetaminophen"

For each contradiction found, provide the specific drug name, the specific lab value or diagnosis code, and the clinical action.

## Summary
Write ONE concise paragraph (2–3 sentences) summarizing the patient's clinical picture. Include: chief concern, key findings, and urgency rationale. This appears on the queue card — be specific, not generic.
${rlPreferences}
## Output
Return structured JSON matching the schema exactly. Be precise with numbers and clinical details.`;
}

// ---------------------------------------------------------------------------
// Patient prompt — formats clinical data for the user message
// ---------------------------------------------------------------------------

export function buildPatientPrompt(ctx: PatientContext): string {
  const rxList =
    ctx.prescriptions.length > 0
      ? ctx.prescriptions
          .map(
            (p) =>
              `  - ${p.drug} ${p.doseValue ?? ""}${p.doseUnit ?? ""} (${p.route ?? "unknown route"})`
          )
          .join("\n")
      : "  None recorded";

  const labList =
    ctx.labs.length > 0
      ? ctx.labs
          .map((l) => `  - ${l.labName}: ${l.value} ${l.unit ?? ""}`)
          .join("\n")
      : "  None recorded";

  const dxList =
    ctx.diagnoses.length > 0
      ? ctx.diagnoses
          .map((d) => `  - ${d.icd9Code}: ${d.shortTitle} (${d.longTitle})`)
          .join("\n")
      : "  None recorded";

  const priorList =
    ctx.priorAdmissions.length > 0
      ? ctx.priorAdmissions
          .map(
            (a) =>
              `  - hadm_id ${a.hadmId}: ${a.admissionDiagnosis} (age at visit: ${a.age})`
          )
          .join("\n")
      : "  No prior admissions";

  return `Score this ER patient:

Patient: hadm_id=${ctx.hadmId} | Age ${ctx.age} | ${ctx.gender}
Chief Complaint / Admission Diagnosis: ${ctx.admissionDiagnosis}

Active Prescriptions (${ctx.prescriptions.length}):
${rxList}

Recent Lab Values (${ctx.labs.length} most recent):
${labList}

Diagnoses (${ctx.diagnoses.length}):
${dxList}

Prior Admissions (${ctx.priorAdmissions.length}):
${priorList}`;
}
