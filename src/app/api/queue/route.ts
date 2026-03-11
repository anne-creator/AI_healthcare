import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { queueEvents } from "@/lib/queue-events";
import { fetchFullQueue } from "@/lib/queue-helpers";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const patients = await fetchFullQueue(status);
  return NextResponse.json({ patients });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { patientId, newPosition } = body as {
    patientId: string;
    newPosition: number;
  };

  if (!patientId || newPosition == null) {
    return NextResponse.json(
      { error: "patientId and newPosition are required" },
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

  const oldPosition = patient.queuePosition;

  if (oldPosition === newPosition) {
    const patients = await fetchFullQueue();
    return NextResponse.json({ patients });
  }

  // Shift positions of patients between old and new positions
  if (newPosition < oldPosition) {
    // Moving up: shift others down (+1) in range [newPosition, oldPosition)
    await prisma.queuePatient.updateMany({
      where: {
        queuePosition: { gte: newPosition, lt: oldPosition },
        id: { not: patientId },
      },
      data: { queuePosition: { increment: 1 } },
    });
  } else {
    // Moving down: shift others up (-1) in range (oldPosition, newPosition]
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

  queueEvents.emit("update");

  const patients = await fetchFullQueue();
  return NextResponse.json({ patients });
}
