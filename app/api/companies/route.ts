import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const companiesWithVerifications = await db.getCompaniesWithVerifications();

    const sorted = companiesWithVerifications.sort((a, b) => {
      const scoreA = a.verification?.fitScore || 0;
      const scoreB = b.verification?.fitScore || 0;
      return scoreB - scoreA;
    });

    return NextResponse.json({
      success: true,
      companies: sorted,
      total: sorted.length,
    });
  } catch (error) {
    console.error("Fetch companies error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch companies",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
