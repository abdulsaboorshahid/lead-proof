"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UploadForm } from "@/components/upload-form";
import { CompaniesTable } from "@/components/companies-table";
import { CompanyWithVerification } from "@/lib/db";
import { 
  PlayCircle, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  Shield,
  Building2,
  Sparkles
} from "lucide-react";

type WorkflowStep = "upload" | "processing" | "results";

export default function Home() {
  const [step, setStep] = useState<WorkflowStep>("upload");
  const [companies, setCompanies] = useState<CompanyWithVerification[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = async () => {
    setStep("processing");
    setProcessing(true);
    setProgress(10);
    setError(null);

    try {
      const response = await fetch("/api/companies/verify", {
        method: "POST",
      });

      setProgress(50);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Verification failed");
      }

      setProgress(80);

      const resultsResponse = await fetch("/api/companies");
      const resultsData = await resultsResponse.json();

      setProgress(100);
      setCompanies(resultsData.companies || []);
      
      setTimeout(() => {
        setStep("results");
        setProcessing(false);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
      setProcessing(false);
      setStep("upload");
    }
  };

  const handleLoadDemo = async () => {
    setStep("processing");
    setProcessing(true);
    setProgress(10);
    setError(null);

    try {
      const response = await fetch("/api/demo", {
        method: "POST",
      });

      setProgress(50);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load demo data");
      }

      setProgress(80);

      const resultsResponse = await fetch("/api/companies");
      const resultsData = await resultsResponse.json();

      setProgress(100);
      setCompanies(resultsData.companies || []);
      
      setTimeout(() => {
        setStep("results");
        setProcessing(false);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load demo");
      setProcessing(false);
      setStep("upload");
    }
  };

  const handleFetchReal = async () => {
    setStep("processing");
    setProcessing(true);
    setProgress(10);
    setError(null);

    try {
      const fetchResponse = await fetch("/api/companies/fetch-real", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          states: ["NY"],
          categories: ["food_and_drink"],
          limit: 10,
          taxonomy: "food_and_drink"
        }),
      });

      setProgress(30);

      if (!fetchResponse.ok) {
        const data = await fetchResponse.json();
        throw new Error(data.error || "Failed to fetch real companies");
      }

      setProgress(50);

      const verifyResponse = await fetch("/api/companies/verify-real", {
        method: "POST",
      });

      setProgress(70);

      if (!verifyResponse.ok) {
        const data = await verifyResponse.json();
        throw new Error(data.error || "Verification failed");
      }

      setProgress(90);

      const resultsResponse = await fetch("/api/companies");
      const resultsData = await resultsResponse.json();

      setProgress(100);
      setCompanies(resultsData.companies || []);
      
      setTimeout(() => {
        setStep("results");
        setProcessing(false);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch real companies");
      setProcessing(false);
      setStep("upload");
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/companies/export");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verified-leads-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setCompanies([]);
    setProgress(0);
    setError(null);
  };

  const stats = {
    total: companies.length,
    highScore: companies.filter(c => (c.verification?.fitScore || 0) >= 70).length,
    withOwner: companies.filter(c => c.verification?.ownerName).length,
    conflicts: companies.filter(c => c.verification?.conflicts && c.verification.conflicts.length > 0).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-600/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-900">Caprae</h1>
                <p className="text-xs text-zinc-600">Lead Verification Tool</p>
              </div>
            </div>
            {step === "results" && (
              <div className="flex gap-2">
                <Button variant="outline" className="text-black" onClick={handleReset}>
                  Start New
                </Button>
                <Button onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Upload Step */}
        {step === "upload" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Verify Acquisition Leads</h2>
              <p className="text-zinc-600 text-lg">
                Upload a list of companies and get verified facts with proof from their websites
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6 h-24 flex items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900">Verified Facts</p>
                      <p className="text-xs text-zinc-600">Every claim has proof</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 h-24 flex items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900">Smart Scoring</p>
                      <p className="text-xs text-zinc-600">Ranked by fit criteria</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 h-24 flex items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900">Conflict Detection</p>
                      <p className="text-xs text-zinc-600">Flags data mismatches</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <UploadForm onUploadComplete={handleUploadComplete} />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-zinc-500">Or</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Fetch Real Companies
                  </CardTitle>
                  <CardDescription>
                    Load real businesses from Overture Maps public dataset
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleFetchReal} variant="default" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Fetch from Overture Maps
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Try Demo Data
                  </CardTitle>
                  <CardDescription>
                    Load 10 pre-verified companies to explore scoring
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleLoadDemo} variant="outline" className="w-full">
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Load Demo Companies
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === "processing" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Processing Companies</CardTitle>
                <CardDescription>
                  Verifying company information and extracting facts from websites
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progress} className="w-full" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">
                    {progress < 30 && "Normalizing domains..."}
                    {progress >= 30 && progress < 60 && "Extracting facts..."}
                    {progress >= 60 && progress < 90 && "Calculating scores..."}
                    {progress >= 90 && "Finalizing results..."}
                  </span>
                  <span className="font-medium text-zinc-900">{progress}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Step */}
        {step === "results" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 h-28">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-600">Total Companies</p>
                      <p className="text-2xl font-bold text-zinc-900">{stats.total}</p>
                    </div>
                    <Building2 className="h-8 w-8 text-zinc-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 h-28">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-600">High Fit Score</p>
                      <p className="text-2xl font-bold text-green-600">{stats.highScore}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 h-28">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-600">Owner Identified</p>
                      <p className="text-2xl font-bold text-zinc-900">{stats.withOwner}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 h-28">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-600">Data Conflicts</p>
                      <p className="text-2xl font-bold text-amber-600">{stats.conflicts}</p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Results Table */}
            <Card>
              <CardHeader>
                <CardTitle>Verified Companies</CardTitle>
                <CardDescription>
                  Ranked by acquisition fit score. Click any row to see detailed evidence.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CompaniesTable companies={companies} />
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-zinc-600">
            Caprae Lead Verification Tool · Built for acquisition searchers · All scores are heuristic
          </p>
        </div>
      </footer>
    </div>
  );
}
