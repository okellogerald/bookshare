"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAdminFlow } from "@/flows/admin-flow-provider";
import { useCopySubmissions } from "@/domain/submissions/queries";
import type { CopySubmissionRecord } from "@/shared/api";
import { PageIntro } from "@/shared/components/page-intro";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusColor(status: string) {
  switch (status) {
    case "approved":
      return "border-primary/[0.15] bg-primary/10 text-primary";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-border/75 bg-background text-muted-foreground";
  }
}

export function SubmissionsWorkspace() {
  const { openFlow } = useAdminFlow();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const submissionsQuery = useCopySubmissions(
    statusFilter === "all" ? undefined : statusFilter
  );
  const submissions = submissionsQuery.data ?? [];

  const filtered = submissions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.authors as string[]).some((a) => a.toLowerCase().includes(q)) ||
      (s.userEmail ?? "").toLowerCase().includes(q) ||
      (s.isbn ?? "").toLowerCase().includes(q)
    );
  });

  function handleRowClick(submission: CopySubmissionRecord) {
    openFlow({ kind: "review-copy-submission", submission });
  }

  return (
    <section className="space-y-8">
      <PageIntro
        title="Copy Submissions"
        description="Review member copy requests. Click a submission to open the review flow where you can match to existing catalog entries or create new ones."
        actions={
          <Button type="button" variant="outline" className="rounded-full px-4" asChild>
            <Link href="/catalog">
              <ArrowLeft className="h-4 w-4" />
              Back to Catalog
            </Link>
          </Button>
        }
      />

      <Card className="border-border/75 bg-card/[0.92]">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Submissions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Member copy requests awaiting review.
              </p>
            </div>
            <Badge
              variant="secondary"
              className="border border-border/75 bg-background px-3 py-1 text-muted-foreground"
            >
              {filtered.length} shown
            </Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, author, email, or ISBN"
            />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="pending">Status: Pending</option>
              <option value="approved">Status: Approved</option>
              <option value="rejected">Status: Rejected</option>
              <option value="all">Status: All</option>
            </Select>
          </div>

          {submissionsQuery.isError ? (
            <p className="text-sm text-red-700">
              {submissionsQuery.error instanceof Error
                ? submissionsQuery.error.message
                : "Failed to load submissions."}
            </p>
          ) : submissionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading submissions...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Authors</TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((submission) => (
                  <TableRow
                    key={submission.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(submission)}
                  >
                    <TableCell className="min-w-[200px] whitespace-normal">
                      <p className="font-medium text-foreground">{submission.title}</p>
                      {submission.isbn ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          ISBN {submission.isbn}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {(submission.authors as string[]).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      {submission.userEmail ?? submission.userId}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn("border px-2 py-0.5", statusColor(submission.status))}
                      >
                        {submission.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(submission.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
