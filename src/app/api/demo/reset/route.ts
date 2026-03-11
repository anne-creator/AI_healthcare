import { NextResponse } from "next/server";
import { resetDemo } from "@/lib/demo-helpers";

export async function POST() {
  try {
    const result = await resetDemo();
    return NextResponse.json({
      success: true,
      message: `Demo reset complete. ${result.patientsSeeded} patients re-seeded.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Demo reset failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
