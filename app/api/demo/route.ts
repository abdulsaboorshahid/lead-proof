import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateDummyData } from "@/lib/dummy-data";
import { calculateScore, calculateEvidenceLevel, detectConflicts } from "@/lib/scoring";

export async function POST() {
  try {
    await db.clearAll();

    const dummyData = generateDummyData();

    const companies = await db.companies.bulkCreate(
      dummyData.map((d) => ({
        domain: d.domain,
        name: d.name,
        importedRevenue: d.importedRevenue ?? null,
        importedEmployees: d.importedEmployees ?? null,
        importedOwner: d.importedOwner ?? null,
        importedPhone: d.importedPhone ?? null,
        importedEmail: d.importedEmail ?? null,
      }))
    );

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const dummyVerification = dummyData[i].verification;

      // Dummy fixtures are hand-authored as already-confirmed data (no
      // real scraped page to quote-check against), so every present
      // field is marked verified. This has to happen BEFORE scoring —
      // calculateScore/calculateEvidenceLevel/detectConflicts all key off
      // the *Verified flags, not just presence, so they need an object
      // that already has them, not the raw fixture (which has no
      // ownerVerified/foundingVerified/etc. fields of its own).
      const verification = {
        ...dummyVerification,
        ownerVerified: !!dummyVerification.ownerName,
        foundingVerified: !!dummyVerification.foundingYear,
        locationVerified: dummyVerification.locationCount !== undefined && dummyVerification.locationCount !== null,
        teamSizeVerified: !!dummyVerification.teamSize,
        phoneVerified: !!dummyVerification.phone,
        emailVerified: !!dummyVerification.email,
      };

      const conflicts = detectConflicts(verification, {
        owner: company.importedOwner,
        employees: company.importedEmployees,
        revenue: company.importedRevenue,
        phone: company.importedPhone,
      });
      const evidence = calculateEvidenceLevel(verification);
      const { score } = calculateScore(verification, company.importedEmployees);

      await db.verificationResults.create({
        companyId: company.id,
        ownerName: verification.ownerName || null,
        ownerQuote: verification.ownerQuote || null,
        ownerSource: verification.ownerSource || null,
        ownerVerified: verification.ownerVerified,
        foundingYear: verification.foundingYear || null,
        foundingQuote: verification.foundingQuote || null,
        foundingSource: verification.foundingSource || null,
        foundingVerified: verification.foundingVerified,
        locationCount: verification.locationCount || null,
        locationQuote: verification.locationQuote || null,
        locationSource: verification.locationSource || null,
        locationVerified: verification.locationVerified,
        teamSize: verification.teamSize || null,
        teamSizeQuote: verification.teamSizeQuote || null,
        teamSizeSource: verification.teamSizeSource || null,
        teamSizeVerified: verification.teamSizeVerified,
        phone: verification.phone || null,
        phoneQuote: verification.phoneQuote || null,
        phoneSource: verification.phoneSource || null,
        phoneVerified: verification.phoneVerified,
        email: verification.email || null,
        emailVerified: verification.emailVerified,
        emailSource: verification.emailSource || null,
        fitScore: score,
        evidenceLevel: evidence.level,
        evidenceCount: evidence.count,
        conflicts: conflicts.length > 0 ? conflicts : null,
        callBrief: verification.callBrief || null,
        processingTimeMs: Math.floor(Math.random() * 2000) + 500,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Demo data loaded successfully",
      companies: companies.length,
    });
  } catch (error) {
    console.error("Demo data error:", error);
    return NextResponse.json(
      {
        error: "Failed to load demo data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
