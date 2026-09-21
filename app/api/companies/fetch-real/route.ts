import { NextRequest, NextResponse } from "next/server";
import { fetchCompaniesByMultipleCategories } from "@/lib/overture-data";
import { db } from "@/lib/db";
import { normalizeDomain } from "@/lib/deduplication";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // No defaults here — app/page.tsx is the source of truth for what gets
    // fetched (states, categories, limit); this route just executes it.
    const { states, categories, limit } = body;

    if (!Array.isArray(states) || states.length === 0 || !categories || !limit) {
      return NextResponse.json(
        { error: "states (string[]), categories (string | string[]), and limit are required" },
        { status: 400 }
      );
    }

    const categoryList: string[] = Array.isArray(categories) ? categories : [categories];

    const places = await fetchCompaniesByMultipleCategories(
      categoryList,
      states,
      Math.ceil(limit / (categoryList.length * states.length))
    );

    if (places.length === 0) {
      return NextResponse.json(
        { error: "No companies found in Overture Maps" },
        { status: 404 }
      );
    }

    await db.clearAll();

    const companies = [];
    const seenDomains = new Set<string>();

    for (const place of places) {
      if (!place.website) continue;

      try {
        const domain = normalizeDomain(place.website);
        if (seenDomains.has(domain)) continue;
        seenDomains.add(domain);

        const company = await db.companies.create({
          domain,
          name: place.name,
          importedRevenue: null,
          importedEmployees: null,
          importedOwner: null,
          importedPhone: place.phone || null,
          importedEmail: place.email || null,
        });

        companies.push(company);

        if (companies.length >= limit) break;
      } catch (error) {
        console.error(`Error processing ${place.name}:`, error);
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      imported: companies.length,
      companies,
      source: "Overture Maps",
      message: `Fetched ${companies.length} real companies from Overture Maps`,
    });
  } catch (error) {
    console.error("Fetch real companies error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch companies from Overture Maps",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
