import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exportToCSV } from "@/lib/csv-parser";

export async function GET() {
  try {
    const companiesWithVerifications = await db.getCompaniesWithVerifications();

    if (companiesWithVerifications.length === 0) {
      return NextResponse.json(
        { error: "No companies to export" },
        { status: 400 }
      );
    }

    const sorted = companiesWithVerifications.sort((a, b) => {
      const scoreA = a.verification?.fitScore || 0;
      const scoreB = b.verification?.fitScore || 0;
      return scoreB - scoreA;
    });

    const exportData = sorted.map((company) => ({
      domain: company.domain,
      name: company.name,
      ownerName: company.verification?.ownerName || null,
      foundingYear: company.verification?.foundingYear || null,
      teamSize: company.verification?.teamSize || null,
      locationCount: company.verification?.locationCount || null,
      phone: company.verification?.phone || null,
      email: company.verification?.email || null,
      fitScore: company.verification?.fitScore || 0,
      evidenceLevel: company.verification?.evidenceLevel || "low",
      callBrief: company.verification?.callBrief || null,
    }));

    const csv = exportToCSV(exportData);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="verified-leads-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      {
        error: "Failed to export companies",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
