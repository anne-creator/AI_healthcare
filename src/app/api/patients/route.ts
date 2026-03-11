import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AlertLevel } from "@/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const search = searchParams.get("search") ?? "";

  const where = search
    ? { admissionDiagnosis: { contains: search, mode: "insensitive" as const } }
    : {};

  const [patients, total] = await Promise.all([
    prisma.clinicalCase.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { hadmId: "asc" },
      include: {
        _count: {
          select: { labs: true, prescriptions: true, diagnoses: true },
        },
      },
    }),
    prisma.clinicalCase.count({ where }),
  ]);

  const result = patients.map((p) => {
    let alertLevel: AlertLevel = "green";
    if (p._count.labs > 500) alertLevel = "red";
    else if (p._count.labs > 200) alertLevel = "yellow";

    return {
      caseId: p.caseId,
      hadmId: p.hadmId,
      age: p.age,
      gender: p.gender,
      admissionDiagnosis: p.admissionDiagnosis,
      alertLevel,
      labCount: p._count.labs,
      prescriptionCount: p._count.prescriptions,
      diagnosisCount: p._count.diagnoses,
    };
  });

  return NextResponse.json({ patients: result, total, page });
}
