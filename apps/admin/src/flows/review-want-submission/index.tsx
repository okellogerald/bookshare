"use client";

import { useState } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  Layers,
  Loader2,
  Plus,
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
  useAuthorSearch,
  useCreateAuthor,
  useCreateBook,
  useCreateEdition,
  type CatalogEditionRecord,
} from "@/domain/catalog/queries";
import type { WantSubmissionRecord, PgBookWithAuthorsView } from "@/shared/api";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
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
  const [createNewBook, setCreateNewBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState(submission.title);
  const [newBookSubtitle, setNewBookSubtitle] = useState(submission.subtitle ?? "");
  const [newBookLanguage, setNewBookLanguage] = useState(submission.language ?? "en");
  const [authorSearch, setAuthorSearch] = useState("");
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<string[]>([]);
  const [selectedAuthorNames, setSelectedAuthorNames] = useState<string[]>([]);
  const authorSearchQuery = useAuthorSearch(authorSearch);
  const authorResults = authorSearchQuery.data ?? [];
  const createAuthorMutation = useCreateAuthor();

  // ── Step 2: Edition (optional) ──
  const editionsQuery = useEditionsByBook(selectedBook?.id ?? null);
  const existingEditions = editionsQuery.data ?? [];
  const [selectedEdition, setSelectedEdition] = useState<CatalogEditionRecord | null>(null);
  const [createNewEdition, setCreateNewEdition] = useState(false);
  const [editionFormat, setEditionFormat] = useState("paperback");
  const [editionIsbn, setEditionIsbn] = useState(submission.isbn ?? "");
  const [editionPublisher, setEditionPublisher] = useState("");
  const [editionYear, setEditionYear] = useState("");
  const [editionPageCount, setEditionPageCount] = useState("");

  // ── Step 3: Want notes ──
  const [wantNotes, setWantNotes] = useState(submission.wantNotes ?? "");

  // ── Reject ──
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // ── Mutations ──
  const createBook = useCreateBook();
  const createEdition = useCreateEdition();
  const approveSubmission = useApproveWantSubmission();
  const rejectSubmission = useRejectWantSubmission();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // ── Derived state ──
  const bookResolved = !!selectedBook || createNewBook;
  const editionReady = !!selectedEdition || createNewEdition || createNewBook;
  const bookSummary = selectedBook
    ? selectedBook.title
    : createNewBook
      ? newBookTitle.trim() || "New book"
      : undefined;
  const editionSummary = selectedEdition
    ? `${formatLabels[selectedEdition.format] ?? selectedEdition.format}${selectedEdition.isbn ? ` · ${selectedEdition.isbn}` : ""}`
    : createNewEdition || createNewBook
      ? `New ${formatLabels[editionFormat] ?? editionFormat}${editionIsbn ? ` · ${editionIsbn}` : ""}`
      : undefined;

  // ── Handlers ──

  function clearBook() {
    setSelectedBook(null);
    setCreateNewBook(false);
    setSelectedEdition(null);
    setCreateNewEdition(false);
  }

  function clearEdition() {
    setSelectedEdition(null);
    setCreateNewEdition(false);
  }

  function addAuthor(id: string, name: string) {
    if (!selectedAuthorIds.includes(id)) {
      setSelectedAuthorIds((prev) => [...prev, id]);
      setSelectedAuthorNames((prev) => [...prev, name]);
    }
    setAuthorSearch("");
  }

  function removeAuthor(index: number) {
    setSelectedAuthorIds((prev) => prev.filter((_, i) => i !== index));
    setSelectedAuthorNames((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateAuthor() {
    if (!authorSearch.trim()) return;
    try {
      const result = await createAuthorMutation.mutateAsync(authorSearch.trim());
      addAuthor(result.id, result.name);
    } catch {
      // handled silently
    }
  }

  async function handleApprove() {
    setError(null);
    setProcessing(true);

    try {
      let bookId = selectedBook?.id ?? null;
      let editionId: string | null = selectedEdition?.id ?? null;

      // Create book if needed.
      if (createNewBook) {
        if (!newBookTitle.trim()) {
          setError("Book title is required.");
          setProcessing(false);
          return;
        }
        const bookResult = await createBook.mutateAsync({
          title: newBookTitle.trim(),
          subtitle: newBookSubtitle.trim() || undefined,
          language: newBookLanguage.trim() || undefined,
          authorIds: selectedAuthorIds.length > 0 ? selectedAuthorIds : undefined,
        });
        bookId = bookResult.id;

        // Always create an edition when creating a new book.
        const edResult = await createEdition.mutateAsync({
          bookId: bookResult.id,
          format: editionFormat as "hardcover" | "paperback" | "mass_market",
          isbn: editionIsbn.trim() || undefined,
          publisher: editionPublisher.trim() || undefined,
          publishedYear: editionYear ? Number(editionYear) : undefined,
          pageCount: editionPageCount ? Number(editionPageCount) : undefined,
        });
        editionId = edResult.id;
      }

      // Create edition for an existing book if needed.
      if (!createNewBook && createNewEdition && selectedBook) {
        const edResult = await createEdition.mutateAsync({
          bookId: selectedBook.id,
          format: editionFormat as "hardcover" | "paperback" | "mass_market",
          isbn: editionIsbn.trim() || undefined,
          publisher: editionPublisher.trim() || undefined,
          publishedYear: editionYear ? Number(editionYear) : undefined,
          pageCount: editionPageCount ? Number(editionPageCount) : undefined,
        });
        editionId = edResult.id;
      }

      if (!bookId) {
        setError("Select or create a book before approving.");
        setProcessing(false);
        return;
      }

      await approveSubmission.mutateAsync({
        id: submission.id,
        bookId,
        editionId: editionId ?? undefined,
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

  // ── Reject view ──
  if (showReject) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">Reject submission</h3>
        <div className="space-y-2">
          <Label>Reason (optional)</Label>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why is this submission being rejected?"
            rows={4}
          />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setShowReject(false)} disabled={processing}>
            Cancel
          </Button>
          <Button type="button" onClick={handleReject} disabled={processing} className="bg-red-600 hover:bg-red-700">
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Reject
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ═══════════════ STEP 1: BOOK ═══════════════ */}
      <section className="space-y-3">
        <StepHeader
          number={1}
          icon={BookOpen}
          label="Book"
          resolved={bookResolved}
          summary={bookSummary}
          onClear={bookResolved ? clearBook : undefined}
        />

        {!bookResolved && (
          <div className="space-y-3 pl-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                className="pl-9"
                placeholder="Search existing books by title..."
              />
            </div>

            {bookSearch.trim().length >= 2 && (
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border/70 p-1">
                {bookSearchQuery.isLoading ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Searching...</p>
                ) : bookResults.length > 0 ? (
                  bookResults.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => {
                        setSelectedBook(book);
                        setSelectedEdition(null);
                        setCreateNewEdition(false);
                      }}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{book.title}</p>
                        {book.subtitle && (
                          <p className="text-xs text-muted-foreground">{book.subtitle}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {book.authors.map((a) => a.name).join(", ") || "No authors"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No matching books found in the catalog.
                  </p>
                )}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setCreateNewBook(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Create new book
            </Button>
          </div>
        )}

        {selectedBook && (
          <div className="ml-10 rounded-lg border border-primary/25 bg-primary/[0.06] px-4 py-3">
            <p className="text-sm font-medium text-foreground">{selectedBook.title}</p>
            {selectedBook.subtitle && (
              <p className="text-xs text-muted-foreground">{selectedBook.subtitle}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {selectedBook.authors.map((a) => a.name).join(", ")}
            </p>
          </div>
        )}

        {createNewBook && (
          <div className="ml-10 space-y-3 rounded-lg border border-border/70 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Title *</Label>
                <Input value={newBookTitle} onChange={(e) => setNewBookTitle(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Subtitle</Label>
                <Input value={newBookSubtitle} onChange={(e) => setNewBookSubtitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Language</Label>
                <Input value={newBookLanguage} onChange={(e) => setNewBookLanguage(e.target.value)} placeholder="en" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Authors</Label>
              {selectedAuthorNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedAuthorNames.map((name, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 border border-border/75 text-xs">
                      {name}
                      <button type="button" onClick={() => removeAuthor(i)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                  placeholder="Search or create author..."
                  className="flex-1"
                />
                {authorSearch.trim().length >= 2 && authorResults.length === 0 && !authorSearchQuery.isLoading && (
                  <Button type="button" variant="outline" size="sm" onClick={handleCreateAuthor} className="gap-1 shrink-0">
                    <Plus className="h-3 w-3" />
                    Create
                  </Button>
                )}
              </div>
              {authorSearch.trim().length >= 2 && authorResults.length > 0 && (
                <div className="max-h-28 space-y-0.5 overflow-y-auto rounded border border-border/70 p-1">
                  {authorResults.map((author) => (
                    <button
                      key={author.id}
                      type="button"
                      onClick={() => addAuthor(author.id, author.name)}
                      className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted/40"
                    >
                      {author.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════ STEP 2: EDITION (optional) ═══════════════ */}
      {bookResolved && (
        <section className="space-y-3">
          <StepHeader
            number={2}
            icon={Layers}
            label="Edition (optional)"
            resolved={editionReady}
            summary={editionSummary}
            onClear={editionReady && !createNewBook ? clearEdition : undefined}
          />

          {selectedBook && !selectedEdition && !createNewEdition && (
            <div className="space-y-3 pl-10">
              {editionsQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading editions...</p>
              ) : existingEditions.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {existingEditions.length} edition{existingEditions.length !== 1 ? "s" : ""} found — select one or create a new one, or skip to link to book only.
                  </p>
                  <div className="space-y-1 rounded-lg border border-border/70 p-1">
                    {existingEditions.map((ed) => (
                      <button
                        key={ed.id}
                        type="button"
                        onClick={() => setSelectedEdition(ed)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted/50"
                      >
                        <div>
                          <span className="font-medium">
                            {formatLabels[ed.format] ?? ed.format}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            {ed.isbn ? `ISBN ${ed.isbn}` : "No ISBN"}
                          </span>
                          {ed.publisher && (
                            <span className="ml-2 text-muted-foreground">· {ed.publisher}</span>
                          )}
                          {ed.published_year && (
                            <span className="ml-1 text-muted-foreground">({ed.published_year})</span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No editions found for this book. Create one below or skip to link to book only.
                </p>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setCreateNewEdition(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Create new edition
              </Button>
            </div>
          )}

          {selectedEdition && (
            <div className="ml-10 rounded-lg border border-primary/25 bg-primary/[0.06] px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {formatLabels[selectedEdition.format] ?? selectedEdition.format}
              </p>
              <p className="text-xs text-muted-foreground">
                {[
                  selectedEdition.isbn ? `ISBN ${selectedEdition.isbn}` : null,
                  selectedEdition.publisher,
                  selectedEdition.published_year ? `(${selectedEdition.published_year})` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No additional details"}
              </p>
            </div>
          )}

          {(createNewEdition || createNewBook) && !selectedEdition && (
            <div className="ml-10 space-y-3 rounded-lg border border-border/70 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Format *</Label>
                  <Select value={editionFormat} onChange={(e) => setEditionFormat(e.target.value)}>
                    <option value="paperback">Paperback</option>
                    <option value="hardcover">Hardcover</option>
                    <option value="mass_market">Mass Market</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ISBN</Label>
                  <Input value={editionIsbn} onChange={(e) => setEditionIsbn(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Publisher</Label>
                  <Input value={editionPublisher} onChange={(e) => setEditionPublisher(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year</Label>
                  <Input value={editionYear} onChange={(e) => setEditionYear(e.target.value)} type="number" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Page count</Label>
                  <Input value={editionPageCount} onChange={(e) => setEditionPageCount(e.target.value)} type="number" />
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══════════════ STEP 3: WANT NOTES ═══════════════ */}
      {bookResolved && (
        <section className="space-y-3">
          <StepHeader
            number={3}
            icon={FileText}
            label="Want notes (optional)"
            resolved={false}
          />

          <div className="ml-10 space-y-3 rounded-lg border border-border/70 p-4">
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={wantNotes}
                onChange={(e) => setWantNotes(e.target.value)}
                placeholder="Override or add notes for this want..."
                rows={3}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Want will be created for{" "}
              <span className="font-medium text-foreground">
                {submission.userEmail ?? submission.userId}
              </span>
              {!selectedEdition && !createNewEdition && !createNewBook && (
                <span className="ml-1 text-muted-foreground/70">· linked to book only (no edition)</span>
              )}
            </p>
          </div>
        </section>
      )}

      {/* ═══════════════ ACTIONS ═══════════════ */}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2 border-t border-border/70 pt-4">
        <Button
          type="button"
          onClick={handleApprove}
          disabled={processing || !bookResolved}
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
          disabled={processing}
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
