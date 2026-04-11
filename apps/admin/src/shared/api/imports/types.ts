export interface ImportIssue {
  file: string;
  rowNumber?: number;
  column?: string;
  sourceRef?: string;
  code: string;
  message: string;
}

export interface ImportSummary {
  mode: "catalog" | "inventory_only";
  replaceInventory: boolean;
  totalRows: number;
  validRows: number;
  issueCount: number;
  files: Record<string, { rowCount: number }>;
  issues: ImportIssue[];
}

export interface ImportRunRecord {
  runId: string;
  status: "invalid" | "validated" | "committed";
  actorUsername: string;
  sourceZipName: string;
  rowCount: number;
  issueCount: number;
  createdAt: string;
  validatedAt: string | null;
  committedAt: string | null;
  summary: ImportSummary;
}

export interface ImportRunValidationResult {
  runId: string;
  status: "invalid" | "validated" | "committed";
  actorUsername: string;
  sourceZipName: string;
  summary: ImportSummary;
}

export interface CommitImportRunResult {
  runId: string;
  status: "committed";
  summary: ImportSummary;
  workflowEvents: {
    attempted: number;
    delivered: number;
  };
}
