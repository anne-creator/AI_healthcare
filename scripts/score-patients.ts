/**
 * scripts/score-patients.ts
 * Pre-scores all queue patients using Gemini AI via Vercel AI SDK.
 * Run: pnpm db:score
 *
 * Prereqs: DB seeded (pnpm db:seed && pnpm db:seed:queue), GOOGLE_GENERATIVE_API_KEY in .env
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Setup — standalone Prisma + Gemini (not using Next.js runtime)
// ---------------------------------------------------------------------------

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_API_KEY,
});
const gemini = google("gemini-2.5-flash");

// ---------------------------------------------------------------------------
// Zod schema (duplicated here because this script runs outside Next.js)
// ---------------------------------------------------------------------------

const ScoringResultSchema = z.object({
  severityScore: z
    .number()
    .min(0)
    .max(100)
    .describe("0–100 urgency score for this patient RIGHT NOW"),
  confidenceScore: z
    .number()
    .min(0)
    .max(100)
    .describe("0–100 confidence in the severity score based on data richness"),
  contradictions: z
    .array(
      z.object({
        severity: z.enum(["CRITICAL", "HIGH", "MODERATE"]),
        title: z.string().describe("Short label"),
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
    .describe("One concise paragraph summarizing clinical picture for queue card"),
  recommendedActions: z
    .array(z.string())
    .describe("Ordered list of recommended clinical actions"),
});

// ---------------------------------------------------------------------------
// System prompt (same as ai-helpers.ts, inlined for standalone execution)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a clinical triage AI for an emergency room. Your job is to score patient urgency and detect drug-lab/drug-disease contradictions from their medical history.

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

## Output
Return structured JSON matching the schema exactly. Be precise with numbers and clinical details.`;

// ---------------------------------------------------------------------------
// Fetch patient context (same logic as ai-helpers.ts)
// ---------------------------------------------------------------------------

async function fetchContext(hadmId: number) {
  const cc = await prisma.clinicalCase.findUnique({
    where: { hadmId },
    include: {
      labs: {
        include: { labInfo: true },
        orderBy: { charttime: "desc" },
        take: 50,
      },
      prescriptions: { orderBy: { startdate: "desc" } },
      diagnoses: {
        include: { diagInfo: true },
        orderBy: { seqNum: "asc" },
      },
    },
  });
  if (!cc) return null;

  const priorAdmissions = await prisma.clinicalCase.findMany({
    where: { subjectId: cc.subjectId, hadmId: { not: hadmId } },
    select: { hadmId: true, admissionDiagnosis: true, age: true },
  });

  return { cc, priorAdmissions };
}

function buildPrompt(
  cc: NonNullable<Awaited<ReturnType<typeof fetchContext>>>
) {
  const { cc: c, priorAdmissions } = cc;

  const rxList =
    c.prescriptions.length > 0
      ? c.prescriptions
          .map(
            (p) =>
              `  - ${p.drug} ${p.doseValue ?? ""}${p.doseUnit ?? ""} (${p.route ?? "?"})`
          )
          .join("\n")
      : "  None recorded";

  const labList =
    c.labs.length > 0
      ? c.labs
          .map((l) => `  - ${l.labInfo.labName}: ${l.value} ${l.unit ?? ""}`)
          .join("\n")
      : "  None recorded";

  const dxList =
    c.diagnoses.length > 0
      ? c.diagnoses
          .map((d) => `  - ${d.icd9Code}: ${d.diagInfo.shortTitle}`)
          .join("\n")
      : "  None recorded";

  const priorList =
    priorAdmissions.length > 0
      ? priorAdmissions
          .map(
            (a) => `  - hadm_id ${a.hadmId}: ${a.admissionDiagnosis} (age ${a.age})`
          )
          .join("\n")
      : "  No prior admissions";

  return `Score this ER patient:

Patient: hadm_id=${c.hadmId} | Age ${c.age} | ${c.gender}
Chief Complaint / Admission Diagnosis: ${c.admissionDiagnosis}

Active Prescriptions (${c.prescriptions.length}):
${rxList}

Recent Lab Values (${c.labs.length} most recent):
${labList}

Diagnoses (${c.diagnoses.length}):
${dxList}

Prior Admissions (${priorAdmissions.length}):
${priorList}`;
}

// ---------------------------------------------------------------------------
// Main — score all queue patients sequentially
// ---------------------------------------------------------------------------

async function main() {
  console.log("🧠 AI Scoring Engine — Batch Mode");
  console.log("   Model: gemini-2.5-flash via Vercel AI SDK\n");

  const patients = await prisma.queuePatient.findMany({
    orderBy: { queuePosition: "asc" },
  });

  if (patients.length === 0) {
    console.error("❌ No queue patients found. Run pnpm db:seed:queue first.");
    process.exit(1);
  }

  console.log(`📋 Found ${patients.length} queue patients to score\n`);

  const results: {
    hadmId: number;
    severity: number;
    confidence: number;
    contradictions: number;
    summary: string;
  }[] = [];

  for (const patient of patients) {
    const ctx = await fetchContext(patient.hadmId);
    if (!ctx) {
      console.warn(`⚠️  No clinical data for hadm_id ${patient.hadmId} — skipping`);
      continue;
    }

    const userPrompt = buildPrompt(ctx);

    console.log(
      `🔄 Scoring hadm_id=${patient.hadmId} (${ctx.cc.admissionDiagnosis.slice(0, 50)})...`
    );

    try {
      const { output } = await generateText({
        model: gemini,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        output: Output.object({ schema: ScoringResultSchema }),
      });

      if (!output) {
        console.warn(`⚠️  AI returned no output for hadm_id ${patient.hadmId}`);
        continue;
      }

      await prisma.queuePatient.update({
        where: { id: patient.id },
        data: {
          severityScore: output.severityScore,
          confidenceScore: output.confidenceScore,
          contradictions: output.contradictions as unknown as undefined,
          aiSummary: output.summary,
          scoredAt: new Date(),
        },
      });

      results.push({
        hadmId: patient.hadmId,
        severity: output.severityScore,
        confidence: output.confidenceScore,
        contradictions: output.contradictions.length,
        summary: output.summary.slice(0, 80) + "...",
      });

      console.log(
        `   ✅ sev=${output.severityScore} conf=${output.confidenceScore} contradictions=${output.contradictions.length}`
      );
    } catch (err) {
      console.error(`   ❌ Failed for hadm_id ${patient.hadmId}:`, err);
    }
  }

  // Re-sort queue positions by severity descending
  console.log("\n📊 Re-sorting queue by severity...");
  const sorted = await prisma.queuePatient.findMany({
    where: { status: { not: "DONE" } },
    orderBy: { severityScore: "desc" },
  });

  for (let i = 0; i < sorted.length; i++) {
    await prisma.queuePatient.update({
      where: { id: sorted[i].id },
      data: { queuePosition: i + 1 },
    });
  }

  // Print summary table
  console.log("\n" + "=".repeat(90));
  console.log("  AI Scoring Results");
  console.log("=".repeat(90));
  console.log(
    `${"hadm_id".padEnd(10)} ${"sev".padStart(4)} ${"conf".padStart(5)} ${"contra".padStart(7)}  summary`
  );
  console.log("-".repeat(90));

  for (const r of results.sort((a, b) => b.severity - a.severity)) {
    console.log(
      `${String(r.hadmId).padEnd(10)} ${String(r.severity).padStart(4)} ${String(r.confidence).padStart(5)} ${String(r.contradictions).padStart(7)}  ${r.summary}`
    );
  }

  console.log(
    `\n🎉 Scored ${results.length}/${patients.length} patients. Queue re-sorted by severity.`
  );
}

main()
  .catch((e) => {
    console.error("💥 Batch scoring failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
