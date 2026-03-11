import { prisma } from "@/lib/db";
import type { QueuePatientResponse } from "@/types";

type QueuePatientWithCase = Awaited<
  ReturnType<typeof prisma.queuePatient.findFirst<{ include: { case: true } }>>
>;

export function serializeQueuePatient(
  p: NonNullable<QueuePatientWithCase>
): QueuePatientResponse {
  return {
    id: p.id,
    hadmId: p.hadmId,
    subjectId: p.subjectId,
    arrivedAt: p.arrivedAt.toISOString(),
    status: p.status,
    queuePosition: p.queuePosition,
    severityScore: p.severityScore,
    confidenceScore: p.confidenceScore,
    contradictions: p.contradictions as unknown[] | null,
    aiSummary: p.aiSummary,
    scoredAt: p.scoredAt?.toISOString() ?? null,
    age: p.case.age,
    gender: p.case.gender,
    admissionDiagnosis: p.case.admissionDiagnosis,
  };
}

export async function fetchFullQueue(
  statusFilter?: string
): Promise<QueuePatientResponse[]> {
  const where = statusFilter
    ? { status: statusFilter as never }
    : {};

  const patients = await prisma.queuePatient.findMany({
    where,
    include: { case: true },
    orderBy: { queuePosition: "asc" },
  });

  return patients.map(serializeQueuePatient);
}
