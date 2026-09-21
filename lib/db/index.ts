// In-memory database for dummy data
// In production, this would connect to Neon Postgres

import { Company, VerificationResult } from "./schema";

export interface CompanyWithVerification extends Company {
  verification?: VerificationResult;
}

// In-memory stores
let companiesStore: Company[] = [];
let verificationsStore: VerificationResult[] = [];
let nextCompanyId = 1;
let nextVerificationId = 1;

export const db = {
  companies: {
    async findByDomain(domain: string): Promise<Company | undefined> {
      return companiesStore.find(c => c.domain === domain);
    },
    
    async create(data: Omit<Company, "id" | "createdAt" | "updatedAt">): Promise<Company> {
      const company: Company = {
        ...data,
        id: nextCompanyId++,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      companiesStore.push(company);
      return company;
    },
    
    async bulkCreate(data: Omit<Company, "id" | "createdAt" | "updatedAt">[]): Promise<Company[]> {
      return Promise.all(data.map(d => this.create(d)));
    },
    
    async findAll(): Promise<Company[]> {
      return [...companiesStore];
    },
    
    async clear(): Promise<void> {
      companiesStore = [];
      nextCompanyId = 1;
    }
  },
  
  verificationResults: {
    async findByCompanyId(companyId: number): Promise<VerificationResult | undefined> {
      return verificationsStore.find(v => v.companyId === companyId);
    },
    
    async create(data: Omit<VerificationResult, "id" | "fetchedAt">): Promise<VerificationResult> {
      const verification: VerificationResult = {
        ...data,
        id: nextVerificationId++,
        fetchedAt: new Date(),
      };
      verificationsStore.push(verification);
      return verification;
    },
    
    async bulkCreate(data: Omit<VerificationResult, "id" | "fetchedAt">[]): Promise<VerificationResult[]> {
      return Promise.all(data.map(d => this.create(d)));
    },
    
    async findAll(): Promise<VerificationResult[]> {
      return [...verificationsStore];
    },
    
    async clear(): Promise<void> {
      verificationsStore = [];
      nextVerificationId = 1;
    }
  },
  
  async getCompaniesWithVerifications(): Promise<CompanyWithVerification[]> {
    const companies = await this.companies.findAll();
    const verifications = await this.verificationResults.findAll();
    
    return companies.map(company => {
      const verification = verifications.find(v => v.companyId === company.id);
      return { ...company, verification };
    });
  },
  
  async clearAll(): Promise<void> {
    await this.companies.clear();
    await this.verificationResults.clear();
  }
};
