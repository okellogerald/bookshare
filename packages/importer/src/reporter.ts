import type { ImportIssue, ImportSummary } from "./types";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function issueToCsvRow(issue: ImportIssue): string {
  const fields = [
    issue.file,
    issue.rowNumber?.toString() ?? "",
    issue.column ?? "",
    issue.sourceRef ?? "",
    issue.code,
    issue.message,
  ];
  return fields.map((field) => escapeCsvField(field)).join(",");
}

export function summaryIssuesToCsv(summary: ImportSummary): string {
  const lines = [
    "file,row_number,column,source_ref,code,message",
    ...summary.issues.map(issueToCsvRow),
  ];
  return `${lines.join("\n")}\n`;
}
