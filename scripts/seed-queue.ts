/**
 * scripts/seed-queue.ts
 * Populates queue_patients with 14 real MIMIC cases for the 3 AM demo.
 * Run: pnpm db:seed:queue
 *
 * Requires clinical_cases to already be populated (run pnpm db:seed first).
 *
 * Status assignment for demo narrative:
 *   index 2 (3rd-highest severity)  → WITH_DOCTOR  (Dr. Chen already seeing them)
 *   index 13 (lowest severity)      → WAITING      (just arrived, AI scored from history)
 *   all others                      → TRIAGED       (queued for doctor, AI scored)
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import scanOutput from "./scan-output.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Demo set at 3 AM — arrivals spread over the prior 4 hours
const DEMO_TIME = new Date("2026-03-10T03:00:00.000Z");

async function main() {
  console.log("🌱 Seeding queue_patients from scan-output.json...\n");

  // Reset live-queue tables only (preserves read-only MIMIC tables)
  await prisma.scoringFeedback.deleteMany();
  await prisma.note.deleteMany();
  await prisma.queuePatient.deleteMany();

  // Sort highest severity first → becomes the natural AI queue order
  const cases = [...scanOutput.selectedCases].sort(
    (a, b) => b.estimatedSeverityScore - a.estimatedSeverityScore
  );

  let triagePosition = 1;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const hadmId = parseInt(c.hadm_id);
    const subjectId = parseInt(c.subject_id);

    // Guard: verify ClinicalCase FK exists before inserting
    const caseExists = await prisma.clinicalCase.findUnique({
      where: { hadmId },
      select: { hadmId: true },
    });
    if (!caseExists) {
      console.warn(`⚠️  hadm_id ${hadmId} not in clinical_cases — skipping (run pnpm db:seed first)`);
      continue;
    }

    const status =
      i === 2
        ? "WITH_DOCTOR"
        : i === cases.length - 1
        ? "WAITING"
        : "TRIAGED";

    // Arrivals spread over 4 hours: earlier index = waited longer
    const minutesAgo = 240 - i * 17;
    const arrivedAt = new Date(DEMO_TIME.getTime() - minutesAgo * 60_000);

    // AI scores immediately: 1 min for WAITING (from history), 5 min for TRIAGED (after nurse)
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
        aiSummary: null, // populated later by AI scoring engine
        scoredAt,
      },
    });

    const posLabel =
      status === "TRIAGED"
        ? `TRIAGED #${String(triagePosition).padEnd(2)}`
        : status.padEnd(12);

    console.log(
      `✅ ${posLabel}  sev=${String(c.estimatedSeverityScore).padStart(3)}  conf=${String(c.estimatedConfidenceScore).padStart(3)}  hadm=${hadmId}  ${c.admission_diagnosis}`
    );

    if (status === "TRIAGED") triagePosition++;
  }

  const summary = await prisma.queuePatient.groupBy({
    by: ["status"],
    _count: true,
  });

  console.log("\n📊 queue_patients summary:");
  for (const r of summary) {
    console.log(`   ${r.status}: ${r._count}`);
  }

  console.log("\n🎉 Queue ready — run pnpm dev to see the Doctor View");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
