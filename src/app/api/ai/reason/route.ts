import { NextRequest } from "next/server";
import { streamText } from "ai";
import { gemini } from "@/lib/ai";
import { fetchPatientContext, buildPatientPrompt } from "@/lib/ai-helpers";

export async function POST(request: NextRequest) {
  const { hadmId } = await request.json();

  const context = await fetchPatientContext(parseInt(hadmId));
  if (!context) {
    return new Response(JSON.stringify({ error: "Patient not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const patientData = buildPatientPrompt(context);

  const result = streamText({
    model: gemini,
    system: `You are a clinical reasoning AI performing a live triage assessment in an emergency room. Think through the patient's case step by step, as if presenting to an attending physician.

Your reasoning should follow this structure:
1. **Chief complaint review** — What brought this patient in? What does their admission diagnosis tell us?
2. **Medication review** — List active medications. Flag any high-risk drugs (anticoagulants, metformin, ACE inhibitors, NSAIDs).
3. **Lab analysis** — Check critical values: creatinine, potassium, INR, BNP, troponin, lactate. Note any values outside normal range with specific numbers.
4. **Contradiction check** — Cross-reference each medication against lab values and diagnoses:
   - Metformin + Creatinine > 1.5 mg/dL → lactic acidosis risk
   - Metformin + CKD (ICD 585.x) → contraindicated
   - ACE inhibitor + K+ > 5.5 → hyperkalemia risk
   - Warfarin + INR > 3.5 → bleeding risk
   - NSAID + CKD → worsens renal function
   - NSAID + CHF (ICD 428.x) → fluid retention
5. **Prior history** — Any relevant prior admissions? Recurring pattern?
6. **Clinical synthesis** — Summarize urgency, key risks, and recommended actions.

Write in a natural clinical voice. Use specific numbers (e.g., "Creatinine is 1.6 mg/dL, exceeding the 1.5 threshold for metformin"). Do not use JSON — write flowing clinical reasoning text. Be thorough but concise.`,
    prompt: patientData,
  });

  return result.toTextStreamResponse();
}
