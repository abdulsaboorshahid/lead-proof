import Papa from "papaparse";

export interface CSVRow {
  domain?: string;
  name?: string;
  revenue?: string | number;
  employees?: string | number;
  owner?: string;
  phone?: string;
  email?: string;
  [key: string]: any;
}

export interface ParsedCompany {
  domain: string;
  name: string;
  importedRevenue?: number;
  importedEmployees?: number;
  importedOwner?: string;
  importedPhone?: string;
  importedEmail?: string;
}

export interface CSVParseResult {
  companies: ParsedCompany[];
  errors: string[];
  warnings: string[];
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

function findColumn(
  headers: string[],
  possibleNames: string[]
): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedNames = possibleNames.map(normalizeHeader);

  for (const name of normalizedNames) {
    const index = normalizedHeaders.indexOf(name);
    if (index !== -1) return index;
  }

  return -1;
}

export function parseCSV(csvContent: string): CSVParseResult {
  const result: CSVParseResult = {
    companies: [],
    errors: [],
    warnings: [],
  };

  try {
    const parsed = Papa.parse<CSVRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors.length > 0) {
      result.errors.push(
        ...parsed.errors.map((err) => `Row ${err.row}: ${err.message}`)
      );
    }

    if (!parsed.data || parsed.data.length === 0) {
      result.errors.push("No data found in CSV");
      return result;
    }

    const headers = Object.keys(parsed.data[0]);
    const domainCol = findColumn(headers, ["domain", "website", "url", "site"]);
    const nameCol = findColumn(headers, ["name", "companyname", "company", "businessname"]);
    const revenueCol = findColumn(headers, ["revenue", "sales", "annualrevenue"]);
    const employeesCol = findColumn(headers, ["employees", "headcount", "teamsize", "staff"]);
    const ownerCol = findColumn(headers, ["owner", "founder", "ceo", "ownername"]);
    const phoneCol = findColumn(headers, ["phone", "phonenumber", "telephone"]);
    const emailCol = findColumn(headers, ["email", "emailaddress"]);

    if (domainCol === -1 && nameCol === -1) {
      result.errors.push(
        "CSV must contain either a 'domain' or 'name' column"
      );
      return result;
    }

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      const rowHeaders = Object.keys(row);

      let domain = domainCol !== -1 ? row[rowHeaders[domainCol]] : undefined;
      let name = nameCol !== -1 ? row[rowHeaders[nameCol]] : undefined;

      if (!domain && !name) {
        result.warnings.push(`Row ${i + 1}: Missing both domain and name, skipped`);
        continue;
      }

      if (!domain && name) {
        domain = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "")
          .substring(0, 20) + ".com";
        result.warnings.push(
          `Row ${i + 1}: No domain provided, using generated domain: ${domain}`
        );
      }

      if (!name && domain) {
        name = domain.replace(/\.(com|net|org|io)$/, "");
      }

      const company: ParsedCompany = {
        domain: String(domain).trim(),
        name: String(name).trim(),
      };

      // Parse optional fields
      if (revenueCol !== -1) {
        const revenue = row[rowHeaders[revenueCol]];
        if (revenue) {
          const parsed = parseInt(String(revenue).replace(/[^0-9]/g, ""));
          if (!isNaN(parsed)) {
            company.importedRevenue = parsed;
          }
        }
      }

      if (employeesCol !== -1) {
        const employees = row[rowHeaders[employeesCol]];
        if (employees) {
          const parsed = parseInt(String(employees).replace(/[^0-9]/g, ""));
          if (!isNaN(parsed)) {
            company.importedEmployees = parsed;
          }
        }
      }

      if (ownerCol !== -1) {
        const owner = row[rowHeaders[ownerCol]];
        if (owner) {
          company.importedOwner = String(owner).trim();
        }
      }

      if (phoneCol !== -1) {
        const phone = row[rowHeaders[phoneCol]];
        if (phone) {
          company.importedPhone = String(phone).trim();
        }
      }

      if (emailCol !== -1) {
        const email = row[rowHeaders[emailCol]];
        if (email) {
          company.importedEmail = String(email).trim();
        }
      }

      result.companies.push(company);
    }

    if (result.companies.length === 0) {
      result.errors.push("No valid companies found in CSV");
    }
  } catch (error) {
    result.errors.push(
      `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return result;
}

export function exportToCSV(
  companies: Array<{
    domain: string;
    name: string;
    ownerName?: string | null;
    foundingYear?: number | null;
    teamSize?: number | null;
    locationCount?: number | null;
    phone?: string | null;
    email?: string | null;
    fitScore: number;
    evidenceLevel: string;
    callBrief?: string | null;
  }>
): string {
  const headers = [
    "Domain",
    "Company Name",
    "Owner",
    "Founded",
    "Team Size",
    "Locations",
    "Phone",
    "Email",
    "Fit Score",
    "Evidence Level",
    "Call Brief",
  ];

  const rows = companies.map((c) => [
    c.domain,
    c.name,
    c.ownerName || "",
    c.foundingYear || "",
    c.teamSize || "",
    c.locationCount || "",
    c.phone || "",
    c.email || "",
    c.fitScore,
    c.evidenceLevel,
    c.callBrief || "",
  ]);

  const csv = Papa.unparse({
    fields: headers,
    data: rows,
  });

  return csv;
}
