"use client";

import { useRecentImportRuns } from "@/domain/imports/queries";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
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

function StatusBadge({ status }: { status: string }) {
  const isCommitted = status === "committed";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "border px-3 py-1",
        isCommitted
          ? "border-primary/[0.15] bg-primary/10 text-primary"
          : "border-border/75 bg-background text-muted-foreground"
      )}
    >
      {formatStatus(status)}
    </Badge>
  );
}

export function RecentImportRunsPanel() {
  const recentRuns = useRecentImportRuns(20);
  const runList = recentRuns.data ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recent runs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the latest import activity separately from the validation flow.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="border border-border/75 bg-background px-3 py-1 text-muted-foreground"
        >
          {runList.length} recorded
        </Badge>
      </div>

      {recentRuns.isError ? (
        <p className="text-sm text-red-700">
          {recentRuns.error instanceof Error
            ? recentRuns.error.message
            : "Failed to load recent runs."}
        </p>
      ) : recentRuns.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading recent runs...</p>
      ) : runList.length === 0 ? (
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
            {runList.map((run) => (
              <TableRow key={run.runId}>
                <TableCell>
                  <p className="font-medium text-foreground">{run.sourceZipName}</p>
                </TableCell>
                <TableCell>
                  <StatusBadge status={run.status} />
                </TableCell>
                <TableCell>{run.rowCount}</TableCell>
                <TableCell>{run.issueCount}</TableCell>
                <TableCell>{formatDate(run.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
