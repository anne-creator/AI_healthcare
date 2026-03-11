-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('WAITING', 'TRIAGED', 'WITH_DOCTOR', 'DONE');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('NURSE', 'DOCTOR');

-- CreateTable
CREATE TABLE "queue_patients" (
    "id" TEXT NOT NULL,
    "hadm_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "arrived_at" TIMESTAMP(3) NOT NULL,
    "status" "PatientStatus" NOT NULL DEFAULT 'WAITING',
    "queue_position" INTEGER NOT NULL,
    "severity_score" DOUBLE PRECISION,
    "confidence_score" DOUBLE PRECISION,
    "contradictions" JSONB,
    "ai_summary" TEXT,
    "scored_at" TIMESTAMP(3),

    CONSTRAINT "queue_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_feedback" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "original_rank" INTEGER NOT NULL,
    "adjusted_rank" INTEGER NOT NULL,
    "adjusted_by" "StaffRole" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "queue_patients_hadm_id_key" ON "queue_patients"("hadm_id");

-- AddForeignKey
ALTER TABLE "queue_patients" ADD CONSTRAINT "queue_patients_hadm_id_fkey" FOREIGN KEY ("hadm_id") REFERENCES "clinical_cases"("hadm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "queue_patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_feedback" ADD CONSTRAINT "scoring_feedback_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "queue_patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
