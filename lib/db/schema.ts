import { pgTable, text, integer, timestamp, boolean, jsonb, serial } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  name: text("name").notNull(),
  importedRevenue: integer("imported_revenue"),
  importedEmployees: integer("imported_employees"),
  importedOwner: text("imported_owner"),
  importedPhone: text("imported_phone"),
  importedEmail: text("imported_email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verificationResults = pgTable("verification_results", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  
  // Extracted facts. Each "*Verified" flag means the fact's quote was
  // actually confirmed present on the scraped page (see
  // verifyValueAuthenticity in lib/ai-verification.ts) — not merely that
  // a value was extracted. A fact can be present but unverified (the AI
  // returned a value whose quote didn't match the page).
  ownerName: text("owner_name"),
  ownerQuote: text("owner_quote"),
  ownerSource: text("owner_source"),
  ownerVerified: boolean("owner_verified"),

  foundingYear: integer("founding_year"),
  foundingQuote: text("founding_quote"),
  foundingSource: text("founding_source"),
  foundingVerified: boolean("founding_verified"),

  locationCount: integer("location_count"),
  locationQuote: text("location_quote"),
  locationSource: text("location_source"),
  locationVerified: boolean("location_verified"),

  teamSize: integer("team_size"),
  teamSizeQuote: text("team_size_quote"),
  teamSizeSource: text("team_size_source"),
  teamSizeVerified: boolean("team_size_verified"),

  phone: text("phone"),
  phoneQuote: text("phone_quote"),
  phoneSource: text("phone_source"),
  phoneVerified: boolean("phone_verified"),

  email: text("email"),
  emailVerified: boolean("email_verified"),
  emailSource: text("email_source"),
  
  // Scoring
  fitScore: integer("fit_score").notNull(),
  evidenceLevel: text("evidence_level").notNull(), // 'high' | 'medium' | 'low'
  evidenceCount: integer("evidence_count").notNull(),
  
  // Conflicts
  conflicts: jsonb("conflicts").$type<string[]>(),
  
  // Call brief
  callBrief: text("call_brief"),
  
  // Metadata
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  processingTimeMs: integer("processing_time_ms"),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type VerificationResult = typeof verificationResults.$inferSelect;
export type NewVerificationResult = typeof verificationResults.$inferInsert;
