import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const hadmIdParam = request.nextUrl.searchParams.get("hadmId");

  if (!id && !hadmIdParam) {
    return NextResponse.json(
      { error: "id or hadmId is required" },
      { status: 400 }
    );
  }

  const where = id
    ? { id }
    : { hadmId: parseInt(hadmIdParam!) };

  const queuePatient = await prisma.queuePatient.findUnique({
    where,
    include: {
      case: {
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
      },
      notes: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!queuePatient) {
    return NextResponse.json(
      { error: "Queue patient not found" },
      { status: 404 }
    );
  }

  const c = queuePatient.case;

  return NextResponse.json({
    id: queuePatient.id,
    hadmId: queuePatient.hadmId,
    subjectId: queuePatient.subjectId,
    arrivedAt: queuePatient.arrivedAt.toISOString(),
    status: queuePatient.status,
    queuePosition: queuePatient.queuePosition,
    severityScore: queuePatient.severityScore,
    confidenceScore: queuePatient.confidenceScore,
    contradictions: queuePatient.contradictions,
    aiSummary: queuePatient.aiSummary,
    scoredAt: queuePatient.scoredAt?.toISOString() ?? null,
    age: c.age,
    gender: c.gender,
    admissionDiagnosis: c.admissionDiagnosis,
    dischargeSummary: c.dischargeSummary,
    diagnoses: c.diagnoses.map((d) => ({
      seqNum: d.seqNum,
      icd9Code: d.icd9Code,
      shortTitle: d.diagInfo.shortTitle,
      longTitle: d.diagInfo.longTitle,
    })),
    labs: c.labs.map((l) => ({
      labName: l.labInfo.labName,
      fluid: l.labInfo.fluid,
      category: l.labInfo.category,
      charttime: l.charttime.toISOString(),
      value: l.value,
      unit: l.unit,
    })),
    prescriptions: c.prescriptions.map((p) => ({
      drug: p.drug,
      doseValue: p.doseValue,
      doseUnit: p.doseUnit,
      route: p.route,
      startdate: p.startdate?.toISOString() ?? null,
      enddate: p.enddate?.toISOString() ?? null,
    })),
    notes: queuePatient.notes.map((n) => ({
      id: n.id,
      role: n.role,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
