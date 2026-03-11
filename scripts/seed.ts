import "dotenv/config";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { parse } from "csv-parse";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const BATCH_SIZE = 500;
const DATASETS_DIR = path.join(__dirname, "..", "datasets");

function readCsvGz<T>(filename: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const rows: T[] = [];
    const filepath = path.join(DATASETS_DIR, filename);

    fs.createReadStream(filepath)
      .pipe(zlib.createGunzip())
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .on("data", (row: T) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

async function batchInsert<T>(
  label: string,
  items: T[],
  insertFn: (batch: T[]) => Promise<unknown>
) {
  console.log(`  Inserting ${items.length} ${label} rows...`);
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await insertFn(batch);
    process.stdout.write(
      `\r  ${label}: ${Math.min(i + BATCH_SIZE, items.length)}/${items.length}`
    );
  }
  console.log(` ✓`);
}

function toInt(val: string | undefined): number {
  return Math.round(parseFloat(val ?? "0"));
}

function toFloat(val: string | undefined): number | null {
  if (!val || val === "") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function toDate(val: string | undefined): Date | null {
  if (!val || val === "") return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function seed() {
  console.log("Starting seed...\n");

  // Step 1: Lab Dictionary
  console.log("[1/6] Lab Dictionary");
  const labDictRows = await readCsvGz<{
    itemid: string;
    lab_name: string;
    fluid: string;
    category: string;
  }>("lab_dictionary.csv.gz");

  await batchInsert("lab_dictionary", labDictRows, (batch) =>
    prisma.labDictionary.createMany({
      data: batch.map((r) => ({
        itemId: toInt(r.itemid),
        labName: r.lab_name,
        fluid: r.fluid,
        category: r.category,
      })),
      skipDuplicates: true,
    })
  );

  // Step 2: Diagnosis Dictionary
  console.log("[2/6] Diagnosis Dictionary");
  const diagDictRows = await readCsvGz<{
    icd9_code: string;
    short_title: string;
    long_title: string;
  }>("diagnosis_dictionary.csv.gz");

  await batchInsert("diagnosis_dictionary", diagDictRows, (batch) =>
    prisma.diagnosisDictionary.createMany({
      data: batch.map((r) => ({
        icd9Code: r.icd9_code,
        shortTitle: r.short_title,
        longTitle: r.long_title,
      })),
      skipDuplicates: true,
    })
  );

  // Step 3: Clinical Cases
  console.log("[3/6] Clinical Cases");
  const caseRows = await readCsvGz<{
    case_id: string;
    subject_id: string;
    hadm_id: string;
    age: string;
    gender: string;
    admission_diagnosis: string;
    discharge_summary: string;
  }>("clinical_cases.csv.gz");

  await batchInsert("clinical_cases", caseRows, (batch) =>
    prisma.clinicalCase.createMany({
      data: batch.map((r) => ({
        caseId: r.case_id,
        subjectId: toInt(r.subject_id),
        hadmId: toInt(r.hadm_id),
        age: toInt(r.age),
        gender: r.gender,
        admissionDiagnosis: r.admission_diagnosis,
        dischargeSummary: r.discharge_summary,
      })),
      skipDuplicates: true,
    })
  );

  // Collect valid hadm_ids for FK validation
  const validHadmIds = new Set(caseRows.map((r) => toInt(r.hadm_id)));
  const validItemIds = new Set(labDictRows.map((r) => toInt(r.itemid)));
  const validIcd9Codes = new Set(diagDictRows.map((r) => r.icd9_code));

  // Step 4: Labs
  console.log("[4/6] Labs");
  const labRows = await readCsvGz<{
    hadm_id: string;
    itemid: string;
    charttime: string;
    value: string;
    unit: string;
  }>("labs_subset.csv.gz");

  const validLabs = labRows.filter(
    (r) => validHadmIds.has(toInt(r.hadm_id)) && validItemIds.has(toInt(r.itemid))
  );

  await batchInsert("labs", validLabs, (batch) =>
    prisma.lab.createMany({
      data: batch.map((r) => ({
        hadmId: toInt(r.hadm_id),
        itemId: toInt(r.itemid),
        charttime: new Date(r.charttime),
        value: toFloat(r.value),
        unit: r.unit || null,
      })),
      skipDuplicates: true,
    })
  );

  // Step 5: Prescriptions
  console.log("[5/6] Prescriptions");
  const rxRows = await readCsvGz<{
    subject_id: string;
    hadm_id: string;
    startdate: string;
    enddate: string;
    drug: string;
    dose_value: string;
    dose_unit: string;
    route: string;
  }>("prescriptions_subset.csv.gz");

  const validRx = rxRows.filter((r) => validHadmIds.has(toInt(r.hadm_id)));

  await batchInsert("prescriptions", validRx, (batch) =>
    prisma.prescription.createMany({
      data: batch.map((r) => ({
        subjectId: toInt(r.subject_id),
        hadmId: toInt(r.hadm_id),
        drug: r.drug,
        doseValue: toFloat(r.dose_value),
        doseUnit: r.dose_unit || null,
        route: r.route || null,
        startdate: toDate(r.startdate),
        enddate: toDate(r.enddate),
      })),
      skipDuplicates: true,
    })
  );

  // Step 6: Diagnoses
  console.log("[6/6] Diagnoses");
  const diagRows = await readCsvGz<{
    subject_id: string;
    hadm_id: string;
    seq_num: string;
    icd9_code: string;
  }>("diagnoses_subset.csv.gz");

  const validDiags = diagRows.filter(
    (r) =>
      validHadmIds.has(toInt(r.hadm_id)) && validIcd9Codes.has(r.icd9_code)
  );

  await batchInsert("diagnoses", validDiags, (batch) =>
    prisma.diagnosis.createMany({
      data: batch.map((r) => ({
        subjectId: toInt(r.subject_id),
        hadmId: toInt(r.hadm_id),
        seqNum: toFloat(r.seq_num),
        icd9Code: r.icd9_code,
      })),
      skipDuplicates: true,
    })
  );

  console.log("\nSeed complete!");
}

seed()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
