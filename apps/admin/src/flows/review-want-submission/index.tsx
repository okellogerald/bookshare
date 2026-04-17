"use client";

import { useState } from "react";
import {
  BookOpen,
  Check,
  Layers,
  Loader2,
  Search,
  X,
} from "lucide-react";
import {
  useApproveWantSubmission,
  useRejectWantSubmission,
} from "@/domain/submissions/queries";
import {
  useCatalogBookSearch,
  useEditionsByBook,
  type CatalogEditionRecord,
} from "@/domain/catalog/queries";
import type { WantSubmissionRecord, PgBookWithAuthorsView } from "@/shared/api";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

// ─── Helpers ────────────────────────────────────────────────

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

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

// ─── Step indicator ─────────────────────────────────────────

function StepHeader({
  number,
  icon: Icon,
  label,
  resolved,
  summary,
  onClear,
}: {
  number: number;
  icon: React.ElementType;
  label: string;
  resolved: boolean;
  summary?: string;
  onClear?: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          resolved
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        {resolved ? <Check className="h-3.5 w-3.5" /> : number}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {resolved && summary && (
          <span className="truncate text-xs text-muted-foreground">— {summary}</span>
        )}
      </div>
      {resolved && onClear && (
        <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-7 w-7 p-0">
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Submitted Data Panel (left) ────────────────────────────

function SubmittedData({ submission }: { submission: WantSubmissionRecord }) {
  const fields = [
    { label: "Title", value: submission.title },
    { label: "Subtitle", value: submission.subtitle },
    { label: "Authors", value: (submission.authors as string[]).join(", ") },
    { label: "ISBN", value: submission.isbn },
    { label: "Language", value: submission.language },
    { label: "Book notes", value: submission.bookDescriptionNotes },
    { label: "Want notes", value: submission.wantNotes },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Badge
          variant="secondary"
          className={cn("border px-2 py-0.5", statusColor(submission.status))}
        >
          {submission.status}
        </Badge>
        <p className="mt-2 text-xs text-muted-foreground">
          From{" "}
          <span className="font-medium text-foreground">
            {submission.userEmail ?? submission.userId}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(submission.createdAt)}</p>
      </div>

      <dl className="space-y-3">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {field.label}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground select-all">
              {field.value || <span className="text-muted-foreground/60">—</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Review Form (right) ────────────────────────────────────

function ReviewForm({
  submission,
  onDone,
}: {
  submission: WantSubmissionRecord;
  onDone: () => void;
}) {
  // ── Step 1: Book ──
  const [bookSearch, setBookSearch] = useState(submission.title);
  const bookSearchQuery = useCatalogBookSearch(bookSearch);
  const bookResults = bookSearchQuery.data ?? [];
  const [selectedBook, setSelectedBook] = useState<PgBookWithAuthorsView | null>(null);

  // ── Step 2: Edition (optional) ──
  const editionsQuery = useEditionsByBook(selectedBook?.id ?? null);
  const existingEditions = editionsQuery.data ?? [];
  const [selectedEdition, setSelectedEdition] = useState<CatalogEditionRecord | null>(null);

  // ── Step 3: Want notes override ──
  const [wantNotes, setWantNotes] = useState(submission.wantNotes ?? "");

  // ── Reject ──
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // ── Mutations ──
  const approveSubmission = useApproveWantSubmission();
  const rejectSubmission = useRejectWantSubmission();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // ── Derived state ──
  const bookSummary = selectedBook?.title;
  const editionSummary = selectedEdition
    ? `${formatLabels[selectedEdition.format] ?? selectedEdition.format}${selectedEdition.isbn ? ` · ${selectedEdition.isbn}` : ""}`
    : undefined;

  function clearBook() {
    setSelectedBook(null);
    setSelectedEdition(null);
  }

  async function handleApprove() {
    if (!selectedBook) {
      setError("Select a book before approving.");
      return;
    }

    setError(null);
    setProcessing(true);
    try {
      await approveSubmission.mutateAsync({
        id: submission.id,
        bookId: selectedBook.id,
        editionId: selectedEdition?.id,
        wantNotes: wantNotes.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    setError(null);
    setProcessing(true);
    try {
      await rejectSubmission.mutateAsync({
        id: submission.id,
        reviewNotes: rejectReason.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ═══════════════ STEP 1: BOOK ═══════════════ */}
      <section className="space-y-3">
        <StepHeader
          number={1}
          icon={BookOpen}
          label="Book"
          resolved={!!selectedBook}
          summary={bookSummary}
          onClear={clearBook}
        />

        {!selectedBook && (
          <div className="space-y-2 pl-10">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                placeholder="Search catalog by title or ISBN"
                className="pl-9"
              />
            </div>

            {bookSearchQuery.isLoading && (
              <p className="text-xs text-muted-foreground">Searching...</p>
            )}

            {bookResults.length > 0 && (
              <ul className="divide-y divide-border/50 rounded-md border border-border/75 bg-background">
                {bookResults.map((book) => (
                  <li key={book.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedBook(book)}
                      className="w-full px-3 py-2 text-left hover:bg-muted/50"
                    >
                      <p className="text-sm font-medium text-foreground">{book.title}</p>
                      {book.authors && book.authors.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {book.authors.map((a: { name: string }) => a.name).join(", ")}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {bookResults.length === 0 && bookSearch.trim().length > 1 && !bookSearchQuery.isLoading && (
              <p className="text-xs text-muted-foreground">
                No catalog matches — the book may need to be added first.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ═══════════════ STEP 2: EDITION (optional) ═══════════════ */}
      {selectedBook && (
        <section className="space-y-3">
          <StepHeader
            number={2}
            icon={Layers}
            label="Edition (optional)"
            resolved={!!selectedEdition}
            summary={editionSummary}
            onClear={selectedEdition ? () => setSelectedEdition(null) : undefined}
          />

          {!selectedEdition && (
            <div className="space-y-2 pl-10">
              {editionsQuery.isLoading && (
                <p className="text-xs text-muted-foreground">Loading editions...</p>
              )}

              {existingEditions.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Optionally link to a specific edition:
                  </p>
                  <ul className="divide-y divide-border/50 rounded-md border border-border/75 bg-background">
                    {existingEditions.map((ed) => (
                      <li key={ed.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedEdition(ed)}
                          className="w-full px-3 py-2 text-left hover:bg-muted/50"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {formatLabels[ed.format] ?? ed.format}
                            {ed.isbn ? ` · ${ed.isbn}` : ""}
                          </p>
                          {ed.published_year && (
                            <p className="text-xs text-muted-foreground">{ed.published_year}</p>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Or skip — the want will be linked to the book without an edition.
                  </p>
                </>
              )}

              {existingEditions.length === 0 && !editionsQuery.isLoading && (
                <p className="text-xs text-muted-foreground">
                  No editions in catalog — want will be linked to the book only.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ═══════════════ STEP 3: WANT NOTES ═══════════════ */}
      {selectedBook && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              3
            </span>
            Want notes (optional)
          </div>
          <div className="pl-10">
            <Textarea
              value={wantNotes}
              onChange={(e) => setWantNotes(e.target.value)}
              placeholder="Override or add notes for this want..."
              rows={3}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Want will be created for{" "}
              <span className="font-medium">{submission.userEmail ?? submission.userId}</span>.
            </p>
          </div>
        </section>
      )}

      {/* ═══════════════ REJECT FLOW ═══════════════ */}
      {showReject && (
        <section className="space-y-3 rounded-md border border-red-200 bg-red-50/50 p-4">
          <p className="text-sm font-semibold text-red-700">Reject this submission?</p>
          <div className="space-y-1">
            <Label htmlFor="reject-reason" className="text-xs text-muted-foreground">
              Reason (optional)
            </Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this submission is being rejected..."
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-red-300 bg-red-50 text-red-700 hover:border-red-400 hover:bg-red-100"
              size="sm"
              onClick={handleReject}
              disabled={processing}
            >
              {processing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Confirm Reject
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReject(false)}
              disabled={processing}
            >
              Cancel
            </Button>
          </div>
        </section>
      )}

      {/* ═══════════════ ACTIONS ═══════════════ */}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2 border-t border-border/70 pt-4">
        <Button
          type="button"
          onClick={handleApprove}
          disabled={processing || !selectedBook}
          className="gap-2"
        >
          {processing && <Loader2 className="h-4 w-4 animate-spin" />}
          <Check className="h-4 w-4" />
          Approve & Create Want
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowReject(true)}
          disabled={processing || showReject}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}

// ─── Main Flow Component ────────────────────────────────────

export function ReviewWantSubmissionFlow({
  submission,
  onClose,
}: {
  submission: WantSubmissionRecord;
  onClose: () => void;
}) {
  if (submission.status !== "pending") {
    return (
      <div className="grid h-full grid-cols-[2fr_3fr] divide-x divide-border/70">
        <div className="overflow-y-auto p-1">
          <SubmittedData submission={submission} />
        </div>
        <div className="flex items-center justify-center p-6">
          <div className="text-center">
            <Badge
              variant="secondary"
              className={cn("border px-3 py-1", statusColor(submission.status))}
            >
              {submission.status}
            </Badge>
            <p className="mt-3 text-sm text-muted-foreground">
              This submission was already {submission.status}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[2fr_3fr] divide-x divide-border/70">
      <div className="overflow-y-auto p-1">
        <SubmittedData submission={submission} />
      </div>
      <div className="overflow-y-auto p-1 pl-5">
        <ReviewForm key={submission.id} submission={submission} onDone={onClose} />
      </div>
    </div>
  );
}
