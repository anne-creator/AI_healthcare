-- CreateTable
CREATE TABLE "clinical_cases" (
    "case_id" TEXT NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "hadm_id" INTEGER NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "admission_diagnosis" TEXT NOT NULL,
    "discharge_summary" TEXT NOT NULL,

    CONSTRAINT "clinical_cases_pkey" PRIMARY KEY ("case_id")
);

-- CreateTable
CREATE TABLE "lab_dictionary" (
    "itemid" INTEGER NOT NULL,
    "lab_name" TEXT NOT NULL,
    "fluid" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "lab_dictionary_pkey" PRIMARY KEY ("itemid")
);

-- CreateTable
CREATE TABLE "diagnosis_dictionary" (
    "icd9_code" TEXT NOT NULL,
    "short_title" TEXT NOT NULL,
    "long_title" TEXT NOT NULL,

    CONSTRAINT "diagnosis_dictionary_pkey" PRIMARY KEY ("icd9_code")
);

-- CreateTable
CREATE TABLE "labs_subset" (
    "id" SERIAL NOT NULL,
    "hadm_id" INTEGER NOT NULL,
    "itemid" INTEGER NOT NULL,
    "charttime" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,

    CONSTRAINT "labs_subset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions_subset" (
    "id" SERIAL NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "hadm_id" INTEGER NOT NULL,
    "drug" TEXT NOT NULL,
    "dose_value" DOUBLE PRECISION,
    "dose_unit" TEXT,
    "route" TEXT,
    "startdate" TIMESTAMP(3),
    "enddate" TIMESTAMP(3),

    CONSTRAINT "prescriptions_subset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses_subset" (
    "id" SERIAL NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "hadm_id" INTEGER NOT NULL,
    "seq_num" DOUBLE PRECISION,
    "icd9_code" TEXT NOT NULL,

    CONSTRAINT "diagnoses_subset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinical_cases_hadm_id_key" ON "clinical_cases"("hadm_id");

-- AddForeignKey
ALTER TABLE "labs_subset" ADD CONSTRAINT "labs_subset_hadm_id_fkey" FOREIGN KEY ("hadm_id") REFERENCES "clinical_cases"("hadm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labs_subset" ADD CONSTRAINT "labs_subset_itemid_fkey" FOREIGN KEY ("itemid") REFERENCES "lab_dictionary"("itemid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions_subset" ADD CONSTRAINT "prescriptions_subset_hadm_id_fkey" FOREIGN KEY ("hadm_id") REFERENCES "clinical_cases"("hadm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses_subset" ADD CONSTRAINT "diagnoses_subset_hadm_id_fkey" FOREIGN KEY ("hadm_id") REFERENCES "clinical_cases"("hadm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses_subset" ADD CONSTRAINT "diagnoses_subset_icd9_code_fkey" FOREIGN KEY ("icd9_code") REFERENCES "diagnosis_dictionary"("icd9_code") ON DELETE RESTRICT ON UPDATE CASCADE;
