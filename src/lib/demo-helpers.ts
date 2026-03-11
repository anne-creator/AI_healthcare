import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db";
import { queueEvents } from "@/lib/queue-events";

const DEMO_TIME = new Date("2026-03-10T03:00:00.000Z");

interface ScanCase {
  slot: string;
  hadm_id: string;
  subject_id: string;
  age: number;
  gender: string;
  admission_diagnosis: string;
  estimatedSeverityScore: number;
  estimatedConfidenceScore: number;
  contradictions: string[];
}

function loadScanOutput(): { selectedCases: ScanCase[] } {
  const raw = readFileSync(
    join(process.cwd(), "scripts", "scan-output.json"),
    "utf-8"
  );
  return JSON.parse(raw);
}

export async function resetDemo() {
  const scanOutput = loadScanOutput();
  const cases = [...scanOutput.selectedCases].sort(
    (a, b) => b.estimatedSeverityScore - a.estimatedSeverityScore
  );

  await prisma.scoringFeedback.deleteMany();
  await prisma.note.deleteMany();
  await prisma.queuePatient.deleteMany();

  let triagePosition = 1;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const hadmId = parseInt(c.hadm_id);
    const subjectId = parseInt(c.subject_id);

    const caseExists = await prisma.clinicalCase.findUnique({
      where: { hadmId },
      select: { hadmId: true },
    });
    if (!caseExists) continue;

    const status =
      i === 2
        ? ("WITH_DOCTOR" as const)
        : i === cases.length - 1
          ? ("WAITING" as const)
          : ("TRIAGED" as const);

    const minutesAgo = 240 - i * 17;
    const arrivedAt = new Date(DEMO_TIME.getTime() - minutesAgo * 60_000);
    const scoredAt = new Date(
      arrivedAt.getTime() + (status === "WAITING" ? 1 : 5) * 60_000
    );

    await prisma.queuePatient.create({
      data: {
        hadmId,
        subjectId,
        arrivedAt,
        status,
        queuePosition: status === "TRIAGED" ? triagePosition : 0,
        severityScore: c.estimatedSeverityScore,
        confidenceScore: c.estimatedConfidenceScore,
        contradictions: c.contradictions,
        aiSummary: null,
        scoredAt,
      },
    });

    if (status === "TRIAGED") triagePosition++;
  }

  queueEvents.emit("update");

  return { patientsSeeded: cases.length };
}

const DEMO_REGISTRATION_HADM_IDS = [
  100227, 100375, 100643, 100950, 101601,
];

export async function registerDemoPatient(chiefComplaint?: string) {
  const existingHadmIds = await prisma.queuePatient.findMany({
    select: { hadmId: true },
  });
  const usedIds = new Set(existingHadmIds.map((p) => p.hadmId));

  let hadmId: number | null = null;
  for (const candidate of DEMO_REGISTRATION_HADM_IDS) {
    if (!usedIds.has(candidate)) {
      const exists = await prisma.clinicalCase.findUnique({
        where: { hadmId: candidate },
        select: { hadmId: true },
      });
      if (exists) {
        hadmId = candidate;
        break;
      }
    }
  }

  if (!hadmId) {
    const available = await prisma.clinicalCase.findFirst({
      where: {
        hadmId: { notIn: Array.from(usedIds) },
      },
      select: { hadmId: true },
    });
    if (!available) return null;
    hadmId = available.hadmId;
  }

  const clinicalCase = await prisma.clinicalCase.findUnique({
    where: { hadmId },
  });
  if (!clinicalCase) return null;

  const maxPosition = await prisma.queuePatient.aggregate({
    _max: { queuePosition: true },
  });
  const nextPosition = (maxPosition._max.queuePosition ?? 0) + 1;

  const newPatient = await prisma.queuePatient.create({
    data: {
      hadmId,
      subjectId: clinicalCase.subjectId,
      arrivedAt: new Date(),
      status: "WAITING",
      queuePosition: nextPosition,
      severityScore: null,
      confidenceScore: null,
      contradictions: [],
      aiSummary: chiefComplaint ?? clinicalCase.admissionDiagnosis,
      scoredAt: null,
    },
  });

  queueEvents.emit("update");

  return { patient: newPatient, hadmId };
}
