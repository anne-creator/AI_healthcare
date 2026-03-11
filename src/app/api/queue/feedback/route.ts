import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { queueEvents } from "@/lib/queue-events";
import { fetchFullQueue } from "@/lib/queue-helpers";
import type { StaffRoleEnum } from "@/types";

export async function GET() {
  const count = await prisma.scoringFeedback.count();
  return NextResponse.json({ count });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { patientId, originalRank, adjustedRank, note, adjustedBy } = body as {
    patientId: string;
    originalRank: number;
    adjustedRank: number;
    note?: string;
    adjustedBy: StaffRoleEnum;
  };

  if (!patientId || originalRank == null || adjustedRank == null || !adjustedBy) {
    return NextResponse.json(
      { error: "patientId, originalRank, adjustedRank, and adjustedBy are required" },
      { status: 400 }
    );
  }

  if (adjustedBy !== "DOCTOR" && adjustedBy !== "NURSE") {
    return NextResponse.json(
      { error: "adjustedBy must be DOCTOR or NURSE" },
      { status: 400 }
    );
  }

  const patient = await prisma.queuePatient.findUnique({
    where: { id: patientId },
  });

  if (!patient) {
    return NextResponse.json(
      { error: "Patient not found" },
      { status: 404 }
    );
  }

  // Perform the reorder (same logic as PATCH /api/queue)
  const oldPosition = patient.queuePosition;
  const newPosition = adjustedRank;

  if (newPosition < oldPosition) {
    await prisma.queuePatient.updateMany({
      where: {
        queuePosition: { gte: newPosition, lt: oldPosition },
        id: { not: patientId },
      },
      data: { queuePosition: { increment: 1 } },
    });
  } else if (newPosition > oldPosition) {
    await prisma.queuePatient.updateMany({
      where: {
        queuePosition: { gt: oldPosition, lte: newPosition },
        id: { not: patientId },
      },
      data: { queuePosition: { decrement: 1 } },
    });
  }

  await prisma.queuePatient.update({
    where: { id: patientId },
    data: { queuePosition: newPosition },
  });

  // Create the scoring feedback record (RL signal)
  const feedback = await prisma.scoringFeedback.create({
    data: {
      patientId,
      originalRank,
      adjustedRank,
      adjustedBy,
      note: note ?? null,
    },
  });

  // If a note was provided, also create a Note record
  let noteRecord = null;
  if (note) {
    noteRecord = await prisma.note.create({
      data: {
        patientId,
        role: adjustedBy,
        content: note,
      },
    });
  }

  queueEvents.emit("update");

  const patients = await fetchFullQueue();

  return NextResponse.json({
    feedback,
    note: noteRecord,
    patients,
  });
}
