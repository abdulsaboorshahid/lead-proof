import { NextRequest, NextResponse } from "next/server";
import { parseCSV } from "@/lib/csv-parser";
import { deduplicateByDomain, normalizeDomain } from "@/lib/deduplication";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvContent } = body;

    if (!csvContent) {
      return NextResponse.json(
        { error: "CSV content is required" },
        { status: 400 }
      );
    }

    const parseResult = parseCSV(csvContent);

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          error: "CSV parsing failed",
          details: parseResult.errors,
        },
        { status: 400 }
      );
    }

    const companiesWithNormalizedDomains = parseResult.companies.map(
      (company) => ({
        ...company,
        domain: normalizeDomain(company.domain),
      })
    );

    const domains = companiesWithNormalizedDomains.map((c) => c.domain);
    const uniqueDomains = deduplicateByDomain(domains);
    const uniqueCompanies = companiesWithNormalizedDomains.filter((company) =>
      uniqueDomains.includes(company.domain)
    );

    await db.clearAll();

    const created = await db.companies.bulkCreate(
      uniqueCompanies.map((c) => ({
        domain: c.domain,
        name: c.name,
        importedRevenue: c.importedRevenue ?? null,
        importedEmployees: c.importedEmployees ?? null,
        importedOwner: c.importedOwner ?? null,
        importedPhone: c.importedPhone ?? null,
        importedEmail: c.importedEmail ?? null,
      }))
    );

    return NextResponse.json({
      success: true,
      imported: created.length,
      duplicatesRemoved: parseResult.companies.length - created.length,
      warnings: parseResult.warnings,
      companies: created,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      {
        error: "Failed to import companies",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
