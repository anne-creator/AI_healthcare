import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { queueEvents } from "@/lib/queue-events";
import { serializeQueuePatient } from "@/lib/queue-helpers";
import type { PatientStatusEnum } from "@/types";

const STATUS_ORDER: PatientStatusEnum[] = [
  "WAITING",
  "TRIAGED",
  "WITH_DOCTOR",
  "DONE",
];

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { patientId, newStatus } = body as {
    patientId: string;
    newStatus: PatientStatusEnum;
  };

  if (!patientId || !newStatus) {
    return NextResponse.json(
      { error: "patientId and newStatus are required" },
      { status: 400 }
    );
  }

  const newIndex = STATUS_ORDER.indexOf(newStatus);
  if (newIndex === -1) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${STATUS_ORDER.join(", ")}` },
      { status: 400 }
    );
  }

  const patient = await prisma.queuePatient.findUnique({
    where: { id: patientId },
    include: { case: true },
  });

  if (!patient) {
    return NextResponse.json(
      { error: "Patient not found" },
      { status: 404 }
    );
  }

  const currentIndex = STATUS_ORDER.indexOf(patient.status);

  if (newIndex !== currentIndex + 1) {
    return NextResponse.json(
      {
        error: `Invalid transition: ${patient.status} → ${newStatus}. Must advance exactly one step.`,
        currentStatus: patient.status,
        validNext: STATUS_ORDER[currentIndex + 1] ?? "none (already DONE)",
      },
      { status: 400 }
    );
  }

  const updated = await prisma.queuePatient.update({
    where: { id: patientId },
    data: { status: newStatus },
    include: { case: true },
  });

  queueEvents.emit("update");

  return NextResponse.json({ patient: serializeQueuePatient(updated) });
}
