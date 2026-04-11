"use client";

import { useMemo, useState } from "react";
import { FileArchive, Upload, Waypoints } from "lucide-react";
import {
  useCommitImportRun,
  useRecentImportRuns,
  useValidateImportZip,
} from "@/shared/queries/imports";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { ImportRunValidationResult } from "@/shared/api";
import { cn } from "@/shared/lib/utils";

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BatchIngestionWorkbench() {
  const [mode, setMode] = useState<"catalog" | "inventory_only">("catalog");
  const [replaceInventory, setReplaceInventory] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [latestRun, setLatestRun] = useState<ImportRunValidationResult | null>(null);
  const recentRuns = useRecentImportRuns();
  const validateImport = useValidateImportZip();
  const commitImport = useCommitImportRun();

  const currentSummary = latestRun?.summary ?? null;
  const filesBreakdown = useMemo(
    () => Object.entries(currentSummary?.files ?? {}),
    [currentSummary]
  );

  const handleValidate = async () => {
    if (!selectedFile) return;

    const result = await validateImport.mutateAsync({
      file: selectedFile,
      mode,
      replaceInventory: mode === "inventory_only" ? replaceInventory : false,
    });

    setLatestRun(result);
  };

  const handleCommit = async () => {
    if (!latestRun || latestRun.status !== "validated") return;

    const result = await commitImport.mutateAsync(latestRun.runId);
    setLatestRun({
      ...latestRun,
      status: result.status,
      summary: result.summary,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Validate a batch ZIP</CardTitle>
            <CardDescription>
              Upload the same ZIP structure used by the importer CLI, review issues in
              the browser, then commit the validated run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-3">
              {[
                { value: "catalog", label: "Catalog ZIP" },
                { value: "inventory_only", label: "Inventory-only ZIP" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    mode === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-primary/30"
                  )}
                  onClick={() =>
                    setMode(option.value as "catalog" | "inventory_only")
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="rounded-[1.25rem] border border-border/80 bg-background/75 p-4">
              <div className="flex items-center gap-2">
                <FileArchive className="h-4 w-4 text-primary" />
                <p className="font-semibold">ZIP contents</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                <code>catalog</code> mode expects <code>books.csv</code> plus{" "}
                <code>editions.csv</code>, optional <code>copies.csv</code> and{" "}
                <code>wishes.csv</code>, and cover files in{" "}
                <code>covers/&lt;isbn&gt;.&lt;ext&gt;</code>.{" "}
                <code>inventory_only</code> mode accepts only <code>copies.csv</code>{" "}
                and/or <code>wishes.csv</code>.
              </p>
            </div>

            <div className="space-y-3">
              <Input
                type="file"
                accept=".zip,application/zip"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
                className="h-auto rounded-[1.25rem] py-4"
              />

              {mode === "inventory_only" ? (
                <label className="flex items-center gap-3 rounded-[1rem] border border-border/80 bg-background/75 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={replaceInventory}
                    onChange={(event) => setReplaceInventory(event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Replace existing inventory state before commit
                </label>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => void handleValidate()}
                disabled={!selectedFile || validateImport.isPending}
              >
                <Upload className="h-4 w-4" />
                {validateImport.isPending ? "Validating..." : "Validate ZIP"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCommit()}
                disabled={
                  !latestRun ||
                  latestRun.status !== "validated" ||
                  commitImport.isPending
                }
              >
                <Waypoints className="h-4 w-4" />
                {commitImport.isPending ? "Committing..." : "Commit Run"}
              </Button>
            </div>

            {validateImport.isError ? (
              <p className="text-sm text-red-700">
                {validateImport.error instanceof Error
                  ? validateImport.error.message
                  : "Batch validation failed."}
              </p>
            ) : null}

            {commitImport.isError ? (
              <p className="text-sm text-red-700">
                {commitImport.error instanceof Error
                  ? commitImport.error.message
                  : "Batch commit failed."}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-background/75">
          <CardHeader>
            <CardTitle>Latest result</CardTitle>
            <CardDescription>
              The most recent validated run stays here so you can inspect issues or
              commit immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!latestRun || !currentSummary ? (
              <p className="text-sm text-muted-foreground">
                Validate a ZIP to see its run ID, row counts, and issues.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>{formatStatus(latestRun.status)}</Badge>
                  <p className="text-sm text-slate-600">
                    Run <span className="font-mono">{latestRun.runId}</span>
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1rem] border border-border/80 bg-card/90 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Total Rows
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {currentSummary.totalRows}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-border/80 bg-card/90 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Issues
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {currentSummary.issueCount}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {filesBreakdown.map(([fileName, fileSummary]) => (
                    <div
                      key={fileName}
                      className="flex items-center justify-between rounded-[1rem] border border-border/70 bg-card/85 px-4 py-3 text-sm"
                    >
                      <span>{fileName}</span>
                      <span className="font-semibold">{fileSummary.rowCount} rows</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Validation issues</CardTitle>
          <CardDescription>
            Issues are persisted in the run summary before commit. A validated run can
            be committed directly from this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!currentSummary ? (
            <p className="text-sm text-muted-foreground">
              No validation output yet.
            </p>
          ) : currentSummary.issues.length === 0 ? (
            <p className="text-sm text-green-700">
              No issues found. This run is ready to commit.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Row</TableHead>
                  <TableHead>Column</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentSummary.issues.slice(0, 120).map((issue, index) => (
                  <TableRow key={`${issue.code}-${issue.file}-${index}`}>
                    <TableCell>{issue.file}</TableCell>
                    <TableCell>{issue.rowNumber ?? "—"}</TableCell>
                    <TableCell>{issue.column ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{issue.code}</TableCell>
                    <TableCell>{issue.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-background/75">
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <CardDescription>
            The browser flow writes the same import run records used by the current CLI
            workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRuns.isError ? (
            <p className="text-sm text-red-700">
              {recentRuns.error instanceof Error
                ? recentRuns.error.message
                : "Failed to load recent runs."}
            </p>
          ) : recentRuns.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading recent runs...</p>
          ) : (recentRuns.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No import runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ZIP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Issues</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentRuns.data ?? []).map((run) => (
                  <TableRow key={run.runId}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{run.sourceZipName}</p>
                        <p className="text-xs text-slate-500">{run.runId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={run.status === "committed" ? "default" : "secondary"}>
                        {formatStatus(run.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{run.rowCount}</TableCell>
                    <TableCell>{run.issueCount}</TableCell>
                    <TableCell>{formatDate(run.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
