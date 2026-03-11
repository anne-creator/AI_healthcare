import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hadm_id: string }> }
) {
  const { hadm_id } = await params;
  const hadmId = parseInt(hadm_id);

  const patient = await prisma.clinicalCase.findUnique({
    where: { hadmId },
    include: {
      diagnoses: {
        include: { diagInfo: true },
        orderBy: { seqNum: "asc" },
      },
      labs: {
        include: { labInfo: true },
        orderBy: { charttime: "desc" },
        take: 100,
      },
      prescriptions: {
        orderBy: { startdate: "desc" },
      },
    },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  return NextResponse.json({
    caseId: patient.caseId,
    hadmId: patient.hadmId,
    subjectId: patient.subjectId,
    age: patient.age,
    gender: patient.gender,
    admissionDiagnosis: patient.admissionDiagnosis,
    dischargeSummary: patient.dischargeSummary,
    diagnoses: patient.diagnoses.map((d) => ({
      seqNum: d.seqNum,
      icd9Code: d.icd9Code,
      shortTitle: d.diagInfo.shortTitle,
      longTitle: d.diagInfo.longTitle,
    })),
    labs: patient.labs.map((l) => ({
      labName: l.labInfo.labName,
      fluid: l.labInfo.fluid,
      category: l.labInfo.category,
      charttime: l.charttime.toISOString(),
      value: l.value,
      unit: l.unit,
    })),
    prescriptions: patient.prescriptions.map((p) => ({
      drug: p.drug,
      doseValue: p.doseValue,
      doseUnit: p.doseUnit,
      route: p.route,
      startdate: p.startdate?.toISOString() ?? null,
      enddate: p.enddate?.toISOString() ?? null,
    })),
  });
}
