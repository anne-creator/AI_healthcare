import { NextRequest, NextResponse } from "next/server";
import { registerDemoPatient } from "@/lib/demo-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chiefComplaint = body.chiefComplaint as string | undefined;

    const result = await registerDemoPatient(chiefComplaint);

    if (!result) {
      return NextResponse.json(
        { error: "No available clinical cases for registration" },
        { status: 404 }
      );
    }

    // Trigger AI scoring for the new patient
    const scoreRes = await fetch(
      new URL("/api/ai/score", request.url).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hadmId: result.hadmId }),
      }
    );

    const scoreData = scoreRes.ok ? await scoreRes.json() : null;

    return NextResponse.json({
      success: true,
      patient: result.patient,
      scoring: scoreData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Registration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
