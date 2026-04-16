"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  Search,
  X,
} from "lucide-react";
import {
  useCopySubmissions,
  useApproveCopySubmission,
  useRejectCopySubmission,
} from "@/domain/submissions/queries";
import {
  useCatalogBookSearch,
  useAuthorSearch,
  useCreateAuthor,
  useCreateBook,
  useCreateEdition,
} from "@/domain/catalog/queries";
import type { CopySubmissionRecord } from "@/shared/api";
import type { PgBookWithAuthorsView } from "@/shared/api";
import { PageIntro } from "@/shared/components/page-intro";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

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

// ─── Submission List Item ───────────────────────────────────

function SubmissionListItem({
  submission,
  selected,
  onSelect,
}: {
  submission: CopySubmissionRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border-b border-border/60 px-4 py-3 text-left transition",
        selected
          ? "bg-primary/[0.06]"
          : "hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground line-clamp-1">
          {submission.title}
        </p>
        <Badge
          variant="secondary"
          className={cn("shrink-0 border px-2 py-0.5 text-[10px]", statusColor(submission.status))}
        >
          {submission.status}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
        {(submission.authors as string[]).join(", ") || "No authors"}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {submission.userEmail ?? submission.userId} · {formatDate(submission.createdAt)}
      </p>
    </button>
  );
}

// ─── Submission Detail (read-only left) ─────────────────────

function SubmissionDetail({
  submission,
}: {
  submission: CopySubmissionRecord;
}) {
  const fields = [
    { label: "Title", value: submission.title },
    { label: "Subtitle", value: submission.subtitle },
    { label: "Authors", value: (submission.authors as string[]).join(", ") },
    { label: "ISBN", value: submission.isbn },
    { label: "Language", value: submission.language },
    { label: "Book notes", value: submission.bookDescriptionNotes },
    { label: "Condition", value: submission.condition },
    { label: "Share type", value: submission.shareType?.replace(/_/g, " ") },
    { label: "Copy notes", value: submission.notes },
    { label: "Contact note", value: submission.contactNote },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Submitted data</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          From {submission.userEmail ?? submission.userId} on{" "}
          {formatDate(submission.createdAt)}
        </p>
      </div>

      <dl className="space-y-3">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {field.label}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground select-all">
              {field.value || <span className="text-muted-foreground">—</span>}
            </dd>
          </div>
        ))}
      </dl>

      {submission.status !== "pending" && (
        <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Review
          </p>
          <p className="mt-1 text-sm text-foreground">
            <Badge
              variant="secondary"
              className={cn("mr-2 border px-2 py-0.5", statusColor(submission.status))}
            >
              {submission.status}
            </Badge>
            by {submission.reviewerUsername ?? "—"} on{" "}
            {formatDate(submission.reviewedAt)}
          </p>
          {submission.reviewNotes ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {submission.reviewNotes}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Review Form (right side) ───────────────────────────────

function ReviewForm({
  submission,
  onDone,
}: {
  submission: CopySubmissionRecord;
  onDone: () => void;
}) {
  // ── Book search/selection ──
  const [bookSearch, setBookSearch] = useState(submission.title);
  const bookSearchQuery = useCatalogBookSearch(bookSearch);
  const bookResults = bookSearchQuery.data ?? [];

  const [selectedBook, setSelectedBook] = useState<PgBookWithAuthorsView | null>(null);
  const [createNewBook, setCreateNewBook] = useState(false);

  // ── New book fields ──
  const [newBookTitle, setNewBookTitle] = useState(submission.title);
  const [newBookSubtitle, setNewBookSubtitle] = useState(submission.subtitle ?? "");
  const [newBookLanguage, setNewBookLanguage] = useState(submission.language ?? "en");
  const [authorSearch, setAuthorSearch] = useState("");
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<string[]>([]);
  const [selectedAuthorNames, setSelectedAuthorNames] = useState<string[]>([]);
  const authorSearchQuery = useAuthorSearch(authorSearch);
  const authorResults = authorSearchQuery.data ?? [];
  const createAuthor = useCreateAuthor();

  // ── Edition selection/creation ──
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null);
  const [createNewEdition, setCreateNewEdition] = useState(false);
  const [editionFormat, setEditionFormat] = useState("paperback");
  const [editionIsbn, setEditionIsbn] = useState(submission.isbn ?? "");
  const [editionPublisher, setEditionPublisher] = useState("");
  const [editionYear, setEditionYear] = useState("");
  const [editionPageCount, setEditionPageCount] = useState("");

  // ── Copy details ──
  const [condition, setCondition] = useState(submission.condition ?? "good");
  const [shareType, setShareType] = useState(submission.shareType ?? "");
  const [copyNotes, setCopyNotes] = useState(submission.notes ?? "");
  const [contactNote, setContactNote] = useState(submission.contactNote ?? "");

  // ── Reject ──
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // ── Mutations ──
  const createBook = useCreateBook();
  const createEdition = useCreateEdition();
  const approveSubmission = useApproveCopySubmission();
  const rejectSubmission = useRejectCopySubmission();

  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const bookEditions = selectedBook?.id
    ? bookResults.find((b) => b.id === selectedBook.id)
    : null;

  // Step tracking
  const hasBook = !!selectedBook || createNewBook;
  const hasEdition = !!selectedEditionId || createNewEdition;

  async function handleApprove() {
    setError(null);
    setProcessing(true);

    try {
      let editionId = selectedEditionId;

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

        // Now create the edition for this book.
        if (!editionId) {
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
      }

      // Create edition for existing book if needed.
      if (!createNewBook && createNewEdition && selectedBook && !editionId) {
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

      if (!editionId) {
        setError("Select or create an edition before approving.");
        setProcessing(false);
        return;
      }

      await approveSubmission.mutateAsync({
        id: submission.id,
        editionId,
        condition: condition || undefined,
        shareType: shareType || undefined,
        notes: copyNotes.trim() || undefined,
        contactNote: contactNote.trim() || undefined,
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
      const result = await createAuthor.mutateAsync(authorSearch.trim());
      addAuthor(result.id, result.name);
    } catch {
      // Author creation failed silently
    }
  }

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
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowReject(false)}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleReject}
            disabled={processing}
            className="bg-red-600 hover:bg-red-700"
          >
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Reject
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold text-foreground">Process submission</h3>

      {/* ── Step 1: Book ── */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          1. Find or create book
        </p>

        {!selectedBook && !createNewBook ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                className="pl-9"
                placeholder="Search existing books..."
              />
            </div>

            {bookSearch.trim().length >= 2 && (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {bookSearchQuery.isLoading ? (
                  <p className="py-2 text-xs text-muted-foreground">Searching...</p>
                ) : bookResults.length > 0 ? (
                  bookResults.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => {
                        setSelectedBook(book);
                        setSelectedEditionId(null);
                        setCreateNewEdition(false);
                      }}
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition hover:bg-muted/40"
                    >
                      <div>
                        <p className="font-medium">{book.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {book.authors.map((a) => a.name).join(", ") || "No authors"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))
                ) : (
                  <p className="py-2 text-xs text-muted-foreground">
                    No matches found.
                  </p>
                )}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateNewBook(true)}
            >
              Create new book
            </Button>
          </div>
        ) : selectedBook ? (
          <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">{selectedBook.title}</p>
              <p className="text-xs text-muted-foreground">
                {selectedBook.authors.map((a) => a.name).join(", ")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedBook(null);
                setSelectedEditionId(null);
                setCreateNewEdition(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : createNewBook ? (
          <div className="space-y-3 rounded-md border border-border/70 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">New book</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCreateNewBook(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Title</Label>
              <Input value={newBookTitle} onChange={(e) => setNewBookTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Subtitle</Label>
              <Input value={newBookSubtitle} onChange={(e) => setNewBookSubtitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Language</Label>
              <Input value={newBookLanguage} onChange={(e) => setNewBookLanguage(e.target.value)} placeholder="en" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Authors</Label>
              {selectedAuthorNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedAuthorNames.map((name, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 border border-border/75">
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
                {authorSearch.trim().length >= 2 && authorResults.length === 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={handleCreateAuthor}>
                    Create
                  </Button>
                )}
              </div>
              {authorSearch.trim().length >= 2 && authorResults.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto">
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
        ) : null}
      </section>

      {/* ── Step 2: Edition ── */}
      {hasBook && (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            2. Find or create edition
          </p>

          {/* Show existing editions for selected book */}
          {selectedBook && !createNewEdition && !selectedEditionId && (
            <div className="space-y-2">
              {(selectedBook as any).editions?.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">Select an existing edition:</p>
                  {/* Note: book search results don't include editions — admin would need to look them up.
                      For now show a message and allow creating new. */}
                </>
              ) : null}
              <p className="text-xs text-muted-foreground">
                If the edition is not in the catalog, create it below.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateNewEdition(true)}
              >
                Create new edition
              </Button>
            </div>
          )}

          {selectedEditionId && (
            <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-2">
              <p className="text-sm font-medium">Edition selected</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEditionId(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {(createNewEdition || createNewBook) && !selectedEditionId && (
            <div className="space-y-3 rounded-md border border-border/70 p-3">
              <p className="text-xs font-medium text-muted-foreground">New edition</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Format</Label>
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

      {/* ── Step 3: Copy details ── */}
      {hasBook && (hasEdition || createNewBook) && (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            3. Copy details
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Condition</Label>
              <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="new">New</option>
                <option value="like_new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Share type</Label>
              <Select value={shareType} onChange={(e) => setShareType(e.target.value)}>
                <option value="">Not specified</option>
                <option value="lend">Lend</option>
                <option value="sell">Sell</option>
                <option value="give_away">Give Away</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Copy notes</Label>
            <Textarea value={copyNotes} onChange={(e) => setCopyNotes(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact note</Label>
            <Textarea value={contactNote} onChange={(e) => setContactNote(e.target.value)} rows={2} />
          </div>
          <p className="text-xs text-muted-foreground">
            Copy will be created for user <span className="font-medium">{submission.userEmail ?? submission.userId}</span>
          </p>
        </section>
      )}

      {/* ── Actions ── */}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2 border-t border-border/70 pt-4">
        <Button
          type="button"
          onClick={handleApprove}
          disabled={processing || (!hasBook || (!hasEdition && !createNewBook))}
          className="gap-2"
        >
          {processing && <Loader2 className="h-4 w-4 animate-spin" />}
          <Check className="h-4 w-4" />
          Approve & Create Copy
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

// ─── Main Workspace ─────────────────────────────────────────

export function SubmissionsWorkspace() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const submissionsQuery = useCopySubmissions(
    statusFilter === "all" ? undefined : statusFilter
  );
  const submissions = submissionsQuery.data ?? [];
  const selectedSubmission = submissions.find((s) => s.id === selectedId) ?? null;

  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "all", label: "All" },
  ];

  const pendingCount = useMemo(
    () =>
      statusFilter === "pending"
        ? submissions.length
        : undefined,
    [statusFilter, submissions.length]
  );

  return (
    <section className="space-y-6">
      <PageIntro
        title="Copy Submissions"
        description="Review member copy requests. Match to existing catalog entries or create new books and editions, then approve to create the copy."
        actions={
          <Button type="button" variant="outline" className="rounded-full px-4" asChild>
            <Link href="/catalog">
              <ArrowLeft className="h-4 w-4" />
              Back to Catalog
            </Link>
          </Button>
        }
      />

      <div className="grid min-h-[600px] grid-cols-[380px_1fr] gap-0 overflow-hidden rounded-xl border border-border/75 bg-card">
        {/* ── Left: Submissions list ── */}
        <div className="flex flex-col border-r border-border/70">
          <div className="flex gap-1 border-b border-border/70 px-3 py-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value);
                  setSelectedId(null);
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  statusFilter === tab.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/40"
                )}
              >
                {tab.label}
                {tab.value === "pending" && pendingCount !== undefined && pendingCount > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {submissionsQuery.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading...</p>
            ) : submissions.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No {statusFilter === "all" ? "" : statusFilter} submissions.
              </p>
            ) : (
              submissions.map((submission) => (
                <SubmissionListItem
                  key={submission.id}
                  submission={submission}
                  selected={selectedId === submission.id}
                  onSelect={() => setSelectedId(submission.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right: Detail + Review form ── */}
        <div className="overflow-y-auto">
          {selectedSubmission ? (
            <div className="grid h-full grid-cols-2 divide-x divide-border/70">
              {/* Left half: submitted data */}
              <div className="overflow-y-auto p-5">
                <SubmissionDetail submission={selectedSubmission} />
              </div>

              {/* Right half: staff form */}
              <div className="overflow-y-auto p-5">
                {selectedSubmission.status === "pending" ? (
                  <ReviewForm
                    key={selectedSubmission.id}
                    submission={selectedSubmission}
                    onDone={() => {
                      setSelectedId(null);
                      void submissionsQuery.refetch();
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-foreground">
                      Already {selectedSubmission.status}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      This submission was {selectedSubmission.status} by{" "}
                      {selectedSubmission.reviewerUsername ?? "—"} on{" "}
                      {formatDate(selectedSubmission.reviewedAt)}.
                    </p>
                    {selectedSubmission.reviewNotes && (
                      <p className="text-sm text-muted-foreground">
                        Notes: {selectedSubmission.reviewNotes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a submission to review
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
