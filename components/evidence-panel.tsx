"use client";

import { CompanyWithVerification } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, User, Calendar, MapPin, Users, Phone, Mail, AlertTriangle, FileText, ShieldCheck, ShieldQuestion, Database } from "lucide-react";

interface EvidencePanelProps {
  company: CompanyWithVerification;
  onClose: () => void;
}

export function EvidencePanel({ company, onClose }: EvidencePanelProps) {
  const v = company.verification;

  if (!v) return null;

  const EvidenceItem = ({
    icon: Icon,
    label,
    value,
    quote,
    source,
    verified,
    imported,
  }: {
    icon: any;
    label: string;
    value: string | number | null | undefined;
    quote?: string | null;
    source?: string | null;
    // Whether this value was actually confirmed present on the scraped
    // page (see verifyValueAuthenticity). A value can exist without this
    // being true — the AI extracted something that couldn't be matched
    // on the page, so it's shown but flagged as unconfirmed.
    verified?: boolean | null;
    // From Overture Maps or the imported CSV — a second source shown for
    // comparison, separate from what verification found on the website.
    imported?: string | null;
  }) => {
    const hasEvidence = value !== null && value !== undefined;
    // hasEvidence && !verified covers both cases: an AI-provided value
    // that couldn't be matched on the page, and (defensively) any future
    // case where a value exists without a verified flag set.
    const isUnconfirmed = hasEvidence && !verified;

    const statusIconClass = !hasEvidence
      ? "text-zinc-400"
      : verified
      ? "text-green-600"
      : "text-amber-500";

    return (
      <div className="space-y-2 pb-4 border-b border-zinc-200 last:border-b-0">
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 mt-0.5 ${statusIconClass}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-medium text-zinc-900">{label}</span>
              {!hasEvidence ? (
                <Badge variant="outline" className="text-xs">Not found</Badge>
              ) : verified ? (
                <Badge variant="success" className="text-xs gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Verified on site
                </Badge>
              ) : (
                <Badge variant="warning" className="text-xs gap-1">
                  <ShieldQuestion className="h-3 w-3" />
                  Found — unconfirmed
                </Badge>
              )}
            </div>
            {hasEvidence ? (
              <>
                <p className="text-sm text-zinc-900 mb-2">{value}</p>
                {isUnconfirmed && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2 w-fit">
                    Extracted by AI, but this value couldn&rsquo;t be matched against the scraped page — treat it as unconfirmed.
                  </p>
                )}
                {quote && (
                  <div className={`rounded-md p-3 text-sm border-l-2 ${verified ? "bg-zinc-50 border-blue-600" : "bg-amber-50 border-amber-400"}`}>
                    <p className="italic text-zinc-700 mb-1">&ldquo;{quote}&rdquo;</p>
                    {source && (
                      <p className="text-xs text-zinc-600">Source: {source}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-600">No information found on website</p>
            )}
            {imported && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2 py-1 w-fit">
                <Database className="h-3 w-3 text-slate-500 flex-shrink-0" />
                <span className="text-xs text-slate-700">
                  <span className="font-medium">Imported (Overture Maps / CSV):</span> {imported}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-1 text-zinc-900">{company.name}</CardTitle>
            <CardDescription className="text-base text-zinc-600">{company.domain}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-600">{v.fitScore}</span>
            <span className="text-sm text-zinc-600">Fit Score</span>
          </div>
          <div className="h-8 w-px bg-zinc-200 mx-2" />
          <Badge variant={v.evidenceLevel === "high" ? "success" : v.evidenceLevel === "medium" ? "warning" : "destructive"}>
            {v.evidenceLevel} evidence ({v.evidenceCount}/6 signals)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {v.conflicts && v.conflicts.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900 mb-1">Data Conflicts Detected</p>
                <ul className="text-sm text-yellow-800 space-y-1">
                  {v.conflicts.map((conflict, i) => (
                    <li key={i}>• {conflict}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <EvidenceItem
            icon={User}
            label="Owner / Founder"
            value={v.ownerName}
            quote={v.ownerQuote}
            source={v.ownerSource}
            verified={v.ownerVerified}
            imported={company.importedOwner}
          />

          <EvidenceItem
            icon={Calendar}
            label="Founding Year"
            value={v.foundingYear ? `${v.foundingYear} (${new Date().getFullYear() - v.foundingYear} years in business)` : null}
            quote={v.foundingQuote}
            source={v.foundingSource}
            verified={v.foundingVerified}
          />

          <EvidenceItem
            icon={MapPin}
            label="Locations"
            value={v.locationCount !== null && v.locationCount !== undefined ? `${v.locationCount} location${v.locationCount !== 1 ? 's' : ''}` : null}
            quote={v.locationQuote}
            source={v.locationSource}
            verified={v.locationVerified}
          />

          <EvidenceItem
            icon={Users}
            label="Team Size"
            value={v.teamSize ? `${v.teamSize} employees` : null}
            quote={v.teamSizeQuote}
            source={v.teamSizeSource}
            verified={v.teamSizeVerified}
            imported={company.importedEmployees ? `${company.importedEmployees} employees` : null}
          />

          <EvidenceItem
            icon={Phone}
            label="Phone Number"
            value={v.phone}
            quote={v.phoneQuote}
            source={v.phoneSource}
            verified={v.phoneVerified}
            imported={company.importedPhone}
          />

          <EvidenceItem
            icon={Mail}
            label="Email"
            value={v.email}
            quote={v.email}
            source={v.emailSource}
            verified={v.emailVerified}
            imported={company.importedEmail}
          />
        </div>

        {v.callBrief && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <div className="flex items-start gap-2">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">Call Brief</p>
                <p className="text-sm text-blue-800">{v.callBrief}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
