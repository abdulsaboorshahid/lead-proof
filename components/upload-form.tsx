"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, AlertCircle } from "lucide-react";

interface UploadFormProps {
  onUploadComplete: () => void;
}

export function UploadForm({ onUploadComplete }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        setError("Please select a CSV file");
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const text = await file.text();

      const response = await fetch("/api/companies/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent: text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import companies");
      }

      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Company List</CardTitle>
        <CardDescription>
          Upload a CSV file with company domains or names. Required columns: domain or name. Optional: revenue, employees, owner.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-zinc-300 rounded-lg p-8 text-center hover:border-blue-600/50 transition-colors">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-upload"
            disabled={uploading}
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <div className="flex flex-col items-center gap-2">
              {file ? (
                <>
                  <FileText className="h-12 w-12 text-blue-600" />
                  <p className="text-sm font-medium text-zinc-900">{file.name}</p>
                  <p className="text-xs text-zinc-600">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-zinc-400" />
                  <p className="text-sm font-medium text-zinc-900">Click to select CSV file</p>
                  <p className="text-xs text-zinc-600">or drag and drop</p>
                </>
              )}
            </div>
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full"
        >
          {uploading ? "Uploading..." : "Import Companies"}
        </Button>
      </CardContent>
    </Card>
  );
}
