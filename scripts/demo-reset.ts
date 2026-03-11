/**
 * scripts/demo-reset.ts
 * Resets the demo to a clean state: clears feedback, notes, and re-seeds queue.
 * Run: pnpm demo:reset
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import scanOutput from "./scan-output.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEMO_TIME = new Date("2026-03-10T03:00:00.000Z");

async function main() {
  console.log("Resetting demo state...\n");

  const fbCount = await prisma.scoringFeedback.count();
  const noteCount = await prisma.note.count();

  await prisma.scoringFeedback.deleteMany();
  await prisma.note.deleteMany();
  await prisma.queuePatient.deleteMany();

  console.log(`  Cleared ${fbCount} feedback records`);
  console.log(`  Cleared ${noteCount} notes`);

  const cases = [...scanOutput.selectedCases].sort(
    (a, b) => b.estimatedSeverityScore - a.estimatedSeverityScore
  );

  let triagePosition = 1;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const hadmId = parseInt(c.hadm_id);
    const subjectId = parseInt(c.subject_id);

    const caseExists = await prisma.clinicalCase.findUnique({
      where: { hadmId },
      select: { hadmId: true },
    });
    if (!caseExists) {
      console.warn(`  hadm_id ${hadmId} not in clinical_cases — skipping`);
      continue;
    }

    const status =
      i === 2
        ? "WITH_DOCTOR"
        : i === cases.length - 1
          ? "WAITING"
          : "TRIAGED";

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

  const summary = await prisma.queuePatient.groupBy({
    by: ["status"],
    _count: true,
  });

  console.log("\n  Queue re-seeded:");
  for (const r of summary) {
    console.log(`    ${r.status}: ${r._count}`);
  }

  console.log("\nDemo reset complete — ready for Sunday.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
