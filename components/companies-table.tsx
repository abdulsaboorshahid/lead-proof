"use client";

import { useEffect, useRef, useState } from "react";
import { CompanyWithVerification } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { EvidencePanel } from "./evidence-panel";

interface CompaniesTableProps {
  companies: CompanyWithVerification[];
}

export function CompaniesTable({ companies }: CompaniesTableProps) {
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithVerification | null>(null);
  const evidencePanelRef = useRef<HTMLDivElement>(null);

  // The evidence panel renders below the table, which can be scrolled out
  // of view (long list, or a click on a row near the top) — bring it into
  // view whenever a company is selected.
  useEffect(() => {
    if (selectedCompany) {
      evidencePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedCompany]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600 font-semibold";
    if (score >= 50) return "text-amber-600 font-semibold";
    return "text-red-600 font-semibold";
  };

  const getEvidenceBadge = (level: string) => {
    if (level === "high") return <Badge variant="success">High Evidence</Badge>;
    if (level === "medium") return <Badge variant="warning">Medium Evidence</Badge>;
    return <Badge variant="destructive">Low Evidence</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-zinc-700">Rank</TableHead>
              <TableHead className="text-zinc-700">Company</TableHead>
              <TableHead className="text-zinc-700">Owner</TableHead>
              <TableHead className="text-zinc-700">Founded</TableHead>
              <TableHead className="text-zinc-700">Team</TableHead>
              <TableHead className="text-zinc-700">Locations</TableHead>
              <TableHead className="text-center text-zinc-700">Score</TableHead>
              <TableHead className="text-center text-zinc-700">Evidence</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-zinc-500">
                  No companies to display
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company, index) => {
                const v = company.verification;
                const hasConflicts = v?.conflicts && v.conflicts.length > 0;

                return (
                  <TableRow key={company.id} className="cursor-pointer" onClick={() => setSelectedCompany(company)}>
                    <TableCell className="font-medium text-zinc-500">
                      #{index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-zinc-500" />
                        <div>
                          <div className="font-medium text-zinc-900">{company.name}</div>
                          <div className="text-xs text-zinc-600">{company.domain}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {v?.ownerName ? (
                        <span className="text-sm text-zinc-900">{v.ownerName}</span>
                      ) : (
                        <span className="text-xs text-zinc-500">Not found</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {v?.foundingYear ? (
                        <div className="text-sm">
                          <div className="text-zinc-900">{v.foundingYear}</div>
                          <div className="text-xs text-zinc-600">
                            {new Date().getFullYear() - v.foundingYear} years
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">Not found</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {v?.teamSize ? (
                        <span className="text-sm text-zinc-900">{v.teamSize} employees</span>
                      ) : (
                        <span className="text-xs text-zinc-500">Not found</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {v?.locationCount !== null && v?.locationCount !== undefined ? (
                        <span className="text-sm text-zinc-900">{v.locationCount}</span>
                      ) : (
                        <span className="text-xs text-zinc-500">Not found</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={getScoreColor(v?.fitScore || 0)}>
                          {v?.fitScore || 0}
                        </span>
                        {hasConflicts && (
                          <Badge variant="outline" className="text-xs">
                            Conflicts
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {v?.evidenceLevel && getEvidenceBadge(v.evidenceLevel)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCompany(company);
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {selectedCompany && (
        <div ref={evidencePanelRef} className="scroll-mt-20">
          <EvidencePanel
            company={selectedCompany}
            onClose={() => setSelectedCompany(null)}
          />
        </div>
      )}
    </div>
  );
}
