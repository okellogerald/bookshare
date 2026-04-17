"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  useCatalogCopies,
  useAdminUpdateCopy,
  useAdminDeleteCopy,
  useAdminArchiveCopy,
  useAdminUnarchiveCopy,
  type CatalogCopyRecord,
} from "@/domain/catalog/queries";
import { useMemberDirectory } from "@/domain/members/queries";
import { PageIntro } from "@/shared/components/page-intro";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

type CopiesSort = "latest_desc" | "title_asc" | "status_asc";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

// ─── Edit copy panel ────────────────────────────────────────

function EditCopyPanel({
  copy,
  onClose,
}: {
  copy: CatalogCopyRecord;
  onClose: () => void;
}) {
  const [condition, setCondition] = useState(copy.condition ?? "");
  const [shareType, setShareType] = useState(copy.share_type ?? "");
  const [notes, setNotes] = useState(copy.notes ?? "");
  const [contactNote, setContactNote] = useState(copy.contact_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const updateMutation = useAdminUpdateCopy();

  async function handleSave() {
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: copy.id,
        condition: condition || undefined,
        shareType: shareType || undefined,
        notes: notes.trim() || undefined,
        contactNote: contactNote.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <div className="mt-2 rounded-md border border-border/75 bg-muted/30 p-4">
      <p className="mb-3 text-sm font-semibold text-foreground">
        Edit copy — {copy.edition?.book?.title ?? "Untitled"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`cond-${copy.id}`} className="text-xs">Condition</Label>
          <Select id={`cond-${copy.id}`} value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="">— not specified —</option>
            <option value="new">New</option>
            <option value="like_new">Like new</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`share-${copy.id}`} className="text-xs">Share type</Label>
          <Select id={`share-${copy.id}`} value={shareType} onChange={(e) => setShareType(e.target.value)}>
            <option value="">— not specified —</option>
            <option value="lend">Lend</option>
            <option value="sell">Sell</option>
            <option value="give_away">Give away</option>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`notes-${copy.id}`} className="text-xs">Notes</Label>
          <Textarea
            id={`notes-${copy.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`contact-${copy.id}`} className="text-xs">Contact note</Label>
          <Textarea
            id={`contact-${copy.id}`}
            value={contactNote}
            onChange={(e) => setContactNote(e.target.value)}
            rows={2}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
          Save
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Copy row actions ────────────────────────────────────────

function CopyRowActions({ copy }: { copy: CatalogCopyRecord }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const deleteMutation = useAdminDeleteCopy();
  const archiveMutation = useAdminArchiveCopy();
  const unarchiveMutation = useAdminUnarchiveCopy();
  const busy = deleteMutation.isPending || archiveMutation.isPending || unarchiveMutation.isPending;

  async function handleDelete() {
    setRowError(null);
    try {
      await deleteMutation.mutateAsync(copy.id);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Delete failed.");
      setConfirmDelete(false);
    }
  }

  async function handleArchive() {
    setRowError(null);
    try {
      await archiveMutation.mutateAsync(copy.id);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Archive failed.");
    }
  }

  async function handleUnarchive() {
    setRowError(null);
    try {
      await unarchiveMutation.mutateAsync(copy.id);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Unarchive failed.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => { setEditing((v) => !v); setConfirmDelete(false); }}
          disabled={busy}
        >
          {editing ? "Cancel edit" : "Edit"}
        </Button>

        {copy.status === "shelved" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleUnarchive}
            disabled={busy}
          >
            {unarchiveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Unarchive"}
          </Button>
        ) : copy.status !== "lent" && copy.status !== "gone" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleArchive}
            disabled={busy}
          >
            {archiveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Archive"}
          </Button>
        ) : null}

        {confirmDelete ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-red-300 bg-red-50 px-2 text-xs text-red-700 hover:border-red-400 hover:bg-red-100"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm delete"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs text-red-700 hover:border-red-300 hover:bg-red-50"
            onClick={() => { setConfirmDelete(true); setEditing(false); }}
            disabled={busy}
          >
            Delete
          </Button>
        )}
      </div>

      {rowError && <p className="mt-1 text-xs text-red-700">{rowError}</p>}
      {editing && <EditCopyPanel copy={copy} onClose={() => setEditing(false)} />}
    </div>
  );
}

// ─── Main workspace ─────────────────────────────────────────

export function CopiesWorkspace() {
  const copiesQuery = useCatalogCopies(200);
  const membersQuery = useMemberDirectory();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CopiesSort>("latest_desc");
  const [statusFilter, setStatusFilter] = useState("all");

  const copies = copiesQuery.data ?? [];

  const memberNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of membersQuery.data ?? []) {
      map.set(member.user_id, member.displayName);
    }
    return map;
  }, [membersQuery.data]);

  const availableStatuses = useMemo(
    () => Array.from(new Set(copies.map((c) => c.status).filter(Boolean))).sort(),
    [copies]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...copies]
      .filter((copy) => {
        if (statusFilter !== "all" && copy.status !== statusFilter) return false;
        if (!normalizedQuery) return true;

        const haystacks = [
          copy.edition?.book?.title?.toLowerCase() ?? "",
          copy.edition?.isbn?.toLowerCase() ?? "",
          copy.user_id.toLowerCase(),
          (memberNamesById.get(copy.user_id) ?? "").toLowerCase(),
        ];

        return haystacks.some((value) => value.includes(normalizedQuery));
      })
      .sort((left, right) => {
        switch (sort) {
          case "title_asc":
            return (left.edition?.book?.title ?? "").localeCompare(
              right.edition?.book?.title ?? "",
              undefined,
              { sensitivity: "base" }
            );
          case "status_asc":
            return left.status.localeCompare(right.status, undefined, { sensitivity: "base" });
          case "latest_desc":
          default:
            return right.created_at.localeCompare(left.created_at);
        }
      });
  }, [copies, memberNamesById, query, sort, statusFilter]);

  return (
    <section className="space-y-8">
      <PageIntro
        title="Copies"
        description="Member-owned inventory rows currently in the system."
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
              <h2 className="text-lg font-semibold text-foreground">Member copies</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse copies already admitted into the system.
              </p>
            </div>
            <Badge
              variant="secondary"
              className="border border-border/75 bg-background px-3 py-1 text-muted-foreground"
            >
              {filtered.length} shown
            </Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search copies by title, ISBN, member, or user ID"
            />
            <Select value={sort} onChange={(event) => setSort(event.target.value as CopiesSort)}>
              <option value="latest_desc">Sort: Latest</option>
              <option value="title_asc">Sort: Title</option>
              <option value="status_asc">Sort: Status</option>
            </Select>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Status: All</option>
              {availableStatuses.map((value) => (
                <option key={value} value={value}>
                  Status: {value}
                </option>
              ))}
            </Select>
          </div>

          {copiesQuery.isError ? (
            <p className="text-sm text-red-700">
              {copiesQuery.error instanceof Error
                ? copiesQuery.error.message
                : "Failed to load copies."}
            </p>
          ) : copiesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading copies...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No copies match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Share Type</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((copy) => (
                  <TableRow key={copy.id}>
                    <TableCell className="min-w-[200px] whitespace-normal">
                      <p className="font-medium text-foreground">
                        {copy.edition?.book?.title ?? "Untitled"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.edition?.isbn || "No ISBN"}
                      </p>
                      <CopyRowActions copy={copy} />
                    </TableCell>
                    <TableCell>{memberNamesById.get(copy.user_id) ?? copy.user_id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{copy.status}</Badge>
                    </TableCell>
                    <TableCell>{copy.share_type || "—"}</TableCell>
                    <TableCell>{formatDate(copy.created_at)}</TableCell>
                    <TableCell />
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
