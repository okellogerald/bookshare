"use client";

import { useId, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Upload, Waypoints, X } from "lucide-react";
import { FlowStepper } from "@/shared/components/flow-stepper";
import { useCommitImportRun, useValidateImportZip } from "@/domain/imports/queries";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
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

type BatchStep = 1 | 2 | 3;

const stepItems: Array<{ step: BatchStep; label: string }> = [
  { step: 1, label: "Type" },
  { step: 2, label: "Upload" },
  { step: 3, label: "Review" },
];

const runTypeOptions: Array<{
  value: "catalog" | "inventory_only";
  label: string;
  description: string;
}> = [
  {
    value: "catalog",
    label: "Catalog ZIP",
    description: "Adds or updates catalog records and inventory rows from the uploaded archive.",
  },
  {
    value: "inventory_only",
    label: "Inventory-only ZIP",
    description: "Touches inventory state only and skips catalog record changes.",
  },
];

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatusBadge({ status }: { status: string }) {
  const isCommitted = status === "committed";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "border px-3 py-1",
        isCommitted
          ? "border-primary/[0.15] bg-primary/10 text-primary"
          : "border-border/75 bg-background px-3 py-1 text-muted-foreground"
      )}
    >
      {formatStatus(status)}
    </Badge>
  );
}

export function ImportBatchFlow() {
  const [activeStep, setActiveStep] = useState<BatchStep>(1);
  const [mode, setMode] = useState<"catalog" | "inventory_only">("catalog");
  const [replaceInventory, setReplaceInventory] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [latestRun, setLatestRun] = useState<ImportRunValidationResult | null>(null);
  const [issuesDialogOpen, setIssuesDialogOpen] = useState(false);
  const fileInputId = useId();
  const validateImport = useValidateImportZip();
  const commitImport = useCommitImportRun();

  const currentSummary = latestRun?.summary ?? null;
  const filesBreakdown = useMemo(
    () => Object.entries(currentSummary?.files ?? {}),
    [currentSummary]
  );

  const canOpenStep = (step: BatchStep) => {
    if (step === 1 || step === 2) {
      return true;
    }

    return !!latestRun;
  };

  const handleModeChange = (nextMode: "catalog" | "inventory_only") => {
    setMode(nextMode);
    setReplaceInventory(false);
    setSelectedFile(null);
    setLatestRun(null);
    setIssuesDialogOpen(false);
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setLatestRun(null);
    setIssuesDialogOpen(false);
  };

  const handleValidate = async () => {
    if (!selectedFile) return;

    const result = await validateImport.mutateAsync({
      file: selectedFile,
      mode,
      replaceInventory: mode === "inventory_only" ? replaceInventory : false,
    });

    setLatestRun(result);
    setActiveStep(3);
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
    <>
      <div className="space-y-6">
        <FlowStepper
          items={stepItems.map((item) => ({
            step: item.step,
            label: item.label,
            current: activeStep === item.step,
            complete:
              (item.step === 1 && activeStep > 1) ||
              (item.step === 2 && !!latestRun) ||
              (item.step === 3 && latestRun?.status === "committed"),
            disabled: !canOpenStep(item.step),
            onSelect: canOpenStep(item.step) ? () => setActiveStep(item.step) : undefined,
          }))}
        />

        {activeStep === 1 ? (
          <section className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Choose the run type</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pick the ingestion mode first. The upload and review steps adapt to this choice.
              </p>
            </div>

            <fieldset className="space-y-4">
              <legend className="text-sm font-medium text-muted-foreground">Run type</legend>

              <div className="space-y-4">
                {runTypeOptions.map((option) => {
                  const checked = mode === option.value;

                  return (
                    <label key={option.value} className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="batch-run-type"
                        value={option.value}
                        checked={checked}
                        onChange={() => handleModeChange(option.value)}
                        className="mt-1 h-4 w-4 border-border text-primary focus:ring-primary"
                      />

                      <div className="space-y-1">
                        <p className={cn("text-sm", checked ? "font-medium text-foreground" : "text-foreground")}>
                          {option.label}
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">{option.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex justify-end border-t pt-5">
              <Button type="button" onClick={() => setActiveStep(2)} className="rounded-full px-5">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : null}

        {activeStep === 2 ? (
          <section className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Upload and validate</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Upload the ZIP archive for validation. Inventory-only runs can optionally replace existing inventory state.
              </p>
            </div>

            <label
              htmlFor={fileInputId}
              className="block cursor-pointer rounded-xl border border-dashed border-border/80 px-5 py-5 transition hover:border-primary/20"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedFile ? selectedFile.name : "Choose a ZIP file"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {selectedFile
                      ? `${Math.round(selectedFile.size / 1024)} KB selected`
                      : "Select the archive to validate."}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="w-fit border border-border/75 bg-background text-muted-foreground"
                >
                  .zip
                </Badge>
              </div>
            </label>
            <input
              id={fileInputId}
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              className="sr-only"
            />

            {mode === "inventory_only" ? (
              <label className="flex items-center gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={replaceInventory}
                  onChange={(event) => setReplaceInventory(event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Replace existing inventory state before commit
              </label>
            ) : null}

            {validateImport.isError ? (
              <p className="text-sm text-red-700">
                {validateImport.error instanceof Error
                  ? validateImport.error.message
                  : "Batch validation failed."}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveStep(1)}
                className="rounded-full px-5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <Button
                type="button"
                onClick={() => void handleValidate()}
                disabled={!selectedFile || validateImport.isPending}
                className="rounded-full px-5"
              >
                <Upload className="h-4 w-4" />
                {validateImport.isPending ? "Validating..." : "Validate ZIP"}
              </Button>
            </div>
          </section>
        ) : null}

        {activeStep === 3 && latestRun && currentSummary ? (
          <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Review and commit</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Inspect the validation summary before the final commit step.
                </p>
              </div>
              <StatusBadge status={latestRun.status} />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>
                Run <span className="font-mono text-foreground">{latestRun.runId}</span>
              </span>
              <span>{currentSummary.totalRows} rows</span>
              <span>{currentSummary.issueCount} issues</span>
            </div>

            {filesBreakdown.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="min-w-[480px] divide-y border-y">
                  {filesBreakdown.map(([fileName, fileSummary]) => (
                    <div
                      key={fileName}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <span className="text-foreground">{fileName}</span>
                      <span className="text-muted-foreground">{fileSummary.rowCount} rows</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {latestRun.status === "invalid" ? (
              <p className="text-sm text-muted-foreground">
                This run has blocking issues and cannot be committed yet.
              </p>
            ) : null}

            {currentSummary.issueCount === 0 ? (
              <p className="text-sm text-primary">
                No validation issues found. This run is ready to commit.
              </p>
            ) : null}

            {commitImport.isError ? (
              <p className="text-sm text-red-700">
                {commitImport.error instanceof Error
                  ? commitImport.error.message
                  : "Batch commit failed."}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveStep(2)}
                className="rounded-full px-5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <div className="flex flex-wrap gap-3">
                {currentSummary.issues.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIssuesDialogOpen(true)}
                    className="rounded-full px-5"
                  >
                    View issues
                  </Button>
                ) : null}

                <Button
                  type="button"
                  onClick={() => void handleCommit()}
                  disabled={latestRun.status !== "validated" || commitImport.isPending}
                  className="rounded-full px-5"
                >
                  <Waypoints className="h-4 w-4" />
                  {commitImport.isPending ? "Committing..." : "Commit run"}
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {issuesDialogOpen && currentSummary ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4 py-8">
          <div className="flex max-h-[80vh] w-full max-w-6xl flex-col rounded-[1.25rem] border bg-card">
            <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Validation issues
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {currentSummary.issues.length} issue
                  {currentSummary.issues.length === 1 ? "" : "s"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Full issue detail for run {latestRun?.runId}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIssuesDialogOpen(false)}
                className="rounded-full border bg-background p-2 text-muted-foreground transition hover:text-foreground"
                aria-label="Close issues dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Row</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentSummary.issues.map((issue, index) => (
                    <TableRow key={`${issue.file}-${issue.rowNumber}-${index}`}>
                      <TableCell className="font-medium">{issue.code}</TableCell>
                      <TableCell>{issue.file}</TableCell>
                      <TableCell>{issue.rowNumber ?? "—"}</TableCell>
                      <TableCell>{issue.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
