"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  useCatalogWishes,
  useAdminUpdateWish,
  useAdminDeleteWish,
  useAdminArchiveWish,
  useAdminRestoreWish,
  type CatalogWishRecord,
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

type WishesSort = "latest_desc" | "title_asc" | "status_asc";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

// ─── Edit wish panel ─────────────────────────────────────────

function EditWishPanel({
  wish,
  onClose,
}: {
  wish: CatalogWishRecord;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(wish.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const updateMutation = useAdminUpdateWish();

  async function handleSave() {
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: wish.id, notes: notes.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <div className="mt-2 rounded-md border border-border/75 bg-muted/30 p-4">
      <p className="mb-3 text-sm font-semibold text-foreground">
        Edit want — {wish.book?.title ?? "Untitled"}
      </p>
      <div className="space-y-1">
        <Label htmlFor={`notes-${wish.id}`} className="text-xs">Notes</Label>
        <Textarea
          id={`notes-${wish.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
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

// ─── Wish row actions ─────────────────────────────────────────

function WishRowActions({ wish }: { wish: CatalogWishRecord }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const deleteMutation = useAdminDeleteWish();
  const archiveMutation = useAdminArchiveWish();
  const restoreMutation = useAdminRestoreWish();
  const busy = deleteMutation.isPending || archiveMutation.isPending || restoreMutation.isPending;

  async function handleArchive() {
    setRowError(null);
    try {
      await archiveMutation.mutateAsync(wish.id);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Archive failed.");
    }
  }

  async function handleRestore() {
    setRowError(null);
    try {
      await restoreMutation.mutateAsync(wish.id);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Restore failed.");
    }
  }

  async function handleDelete() {
    setRowError(null);
    try {
      await deleteMutation.mutateAsync(wish.id);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Delete failed.");
      setConfirmDelete(false);
    }
  }

  const canArchive = wish.status === "active";
  const canRestore = wish.status === "cancelled";

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

        {canArchive && (
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
        )}

        {canRestore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleRestore}
            disabled={busy}
          >
            {restoreMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Restore"}
          </Button>
        )}

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
      {editing && <EditWishPanel wish={wish} onClose={() => setEditing(false)} />}
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────

export function WishesWorkspace() {
  const wishesQuery = useCatalogWishes(200);
  const membersQuery = useMemberDirectory();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<WishesSort>("latest_desc");
  const [statusFilter, setStatusFilter] = useState("all");

  const wishes = wishesQuery.data ?? [];

  const memberNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of membersQuery.data ?? []) {
      map.set(member.user_id, member.displayName);
    }
    return map;
  }, [membersQuery.data]);

  const availableStatuses = useMemo(
    () => Array.from(new Set(wishes.map((w) => w.status).filter(Boolean))).sort(),
    [wishes]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...wishes]
      .filter((wish) => {
        if (statusFilter !== "all" && wish.status !== statusFilter) return false;
        if (!normalizedQuery) return true;

        const haystacks = [
          wish.book?.title?.toLowerCase() ?? "",
          wish.edition?.isbn?.toLowerCase() ?? "",
          wish.user_id.toLowerCase(),
          (memberNamesById.get(wish.user_id) ?? "").toLowerCase(),
        ];

        return haystacks.some((value) => value.includes(normalizedQuery));
      })
      .sort((left, right) => {
        switch (sort) {
          case "title_asc":
            return (left.book?.title ?? "").localeCompare(right.book?.title ?? "", undefined, {
              sensitivity: "base",
            });
          case "status_asc":
            return left.status.localeCompare(right.status, undefined, { sensitivity: "base" });
          case "latest_desc":
          default:
            return right.created_at.localeCompare(left.created_at);
        }
      });
  }, [memberNamesById, query, sort, statusFilter, wishes]);

  return (
    <section className="space-y-8">
      <PageIntro
        title="Wishes"
        description="Member wishes currently stored in the platform."
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
              <h2 className="text-lg font-semibold text-foreground">Member wishes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse wishes already stored in the platform.
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
              placeholder="Search wishes by title, ISBN, member, or user ID"
            />
            <Select value={sort} onChange={(event) => setSort(event.target.value as WishesSort)}>
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

          {wishesQuery.isError ? (
            <p className="text-sm text-red-700">
              {wishesQuery.error instanceof Error
                ? wishesQuery.error.message
                : "Failed to load wishes."}
            </p>
          ) : wishesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading wishes...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wishes match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Edition</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((wish) => (
                  <TableRow key={wish.id}>
                    <TableCell className="min-w-[200px] whitespace-normal">
                      <p className="font-medium text-foreground">
                        {wish.book?.title ?? "Untitled"}
                      </p>
                      {wish.book?.subtitle ? (
                        <p className="mt-1 text-xs text-muted-foreground">{wish.book.subtitle}</p>
                      ) : null}
                      <WishRowActions wish={wish} />
                    </TableCell>
                    <TableCell>{memberNamesById.get(wish.user_id) ?? wish.user_id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{wish.status}</Badge>
                    </TableCell>
                    <TableCell>{wish.edition?.isbn || "Any edition"}</TableCell>
                    <TableCell>{formatDate(wish.created_at)}</TableCell>
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
