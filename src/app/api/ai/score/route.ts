import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { gemini } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { queueEvents } from "@/lib/queue-events";
import {
  fetchPatientContext,
  buildScoringSystemPrompt,
  buildPatientPrompt,
  fetchRLPreferences,
  ScoringResultSchema,
} from "@/lib/ai-helpers";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { hadmId } = body as { hadmId: number };

  if (!hadmId) {
    return NextResponse.json(
      { error: "hadmId is required" },
      { status: 400 }
    );
  }

  const queuePatient = await prisma.queuePatient.findUnique({
    where: { hadmId },
  });

  if (!queuePatient) {
    return NextResponse.json(
      { error: `No queue patient with hadmId ${hadmId}` },
      { status: 404 }
    );
  }

  const context = await fetchPatientContext(hadmId);
  if (!context) {
    return NextResponse.json(
      { error: `No clinical data for hadmId ${hadmId}` },
      { status: 404 }
    );
  }

  const rlPreferences = await fetchRLPreferences();
  const systemPrompt = buildScoringSystemPrompt(rlPreferences);
  const userPrompt = buildPatientPrompt(context);

  const { output } = await generateText({
    model: gemini,
    system: systemPrompt,
    prompt: userPrompt,
    output: Output.object({ schema: ScoringResultSchema }),
  });

  if (!output) {
    return NextResponse.json(
      { error: "AI failed to generate a valid scoring result" },
      { status: 500 }
    );
  }

  await prisma.queuePatient.update({
    where: { hadmId },
    data: {
      severityScore: output.severityScore,
      confidenceScore: output.confidenceScore,
      contradictions: output.contradictions as unknown as undefined,
      aiSummary: output.summary,
      scoredAt: new Date(),
    },
  });

  // Re-sort queue positions by severity (highest = position 1)
  const allPatients = await prisma.queuePatient.findMany({
    where: { status: { not: "DONE" } },
    orderBy: { severityScore: "desc" },
  });

  for (let i = 0; i < allPatients.length; i++) {
    await prisma.queuePatient.update({
      where: { id: allPatients[i].id },
      data: { queuePosition: i + 1 },
    });
  }

  queueEvents.emit("update");

  return NextResponse.json({
    hadmId,
    scoring: output,
  });
}
