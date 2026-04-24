"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ArrowLeft, Edit, Loader2, Plus } from "lucide-react";
import {
  useCatalogCopies,
  useAdminArchiveCopy,
  useAdminUnarchiveCopy,
  type CatalogCopyImageRecord,
  type CatalogCopyRecord,
} from "@/domain/catalog/queries";
import { useMemberDirectory } from "@/domain/members/queries";
import { useAdminFlow } from "@/flows/admin-flow-provider";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
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

type CopiesSort = "latest_desc" | "title_asc" | "status_asc";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function CopyRowActions({ copy }: { copy: CatalogCopyRecord }) {
  const { openFlow } = useAdminFlow();
  const [rowError, setRowError] = useState<string | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  const archiveMutation = useAdminArchiveCopy();
  const unarchiveMutation = useAdminUnarchiveCopy();
  const busy = archiveMutation.isPending || unarchiveMutation.isPending;

  const canArchive = copy.status !== "shelved" && copy.status !== "lent" && copy.status !== "gone";
  const canUnarchive = copy.status === "shelved";

  // Archive is destructive (shelves a member's copy). Gate it behind an
  // explicit confirmation so a stray click can't remove inventory.
  async function confirmArchive() {
    setRowError(null);
    try {
      await archiveMutation.mutateAsync(copy.id);
      setArchiveConfirmOpen(false);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Archive failed.");
      setArchiveConfirmOpen(false);
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

  const copyLabel = copy.edition?.book?.title ?? "this copy";

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => openFlow({ kind: "edit-copy", copy })}
          disabled={busy}
        >
          <Edit className="h-4 w-4" />
          Edit
        </Button>

        {canArchive && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setArchiveConfirmOpen(true)}
            disabled={busy}
          >
            {archiveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Archive
          </Button>
        )}

        {canUnarchive && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleUnarchive}
            disabled={busy}
          >
            {unarchiveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArchiveRestore className="h-4 w-4" />
            )}
            Unarchive
          </Button>
        )}
      </div>

      {rowError && <p className="mt-1 text-xs text-red-700">{rowError}</p>}

      <ConfirmDialog
        open={archiveConfirmOpen}
        title="Archive this copy?"
        description={`"${copyLabel}" will be moved to the shelved state and removed from active inventory. You can unarchive it later if needed.`}
        confirmLabel="Archive"
        isLoading={archiveMutation.isPending}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveConfirmOpen(false)}
      />
    </>
  );
}

function EditionCoverThumb({ url, title }: { url: string | null; title: string }) {
  // The edition cover is the publisher's canonical cover image. It gives each
  // row a stable visual anchor even when a member hasn't uploaded copy photos.
  if (!url) {
    return (
      <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-border/75 bg-muted text-[10px] font-medium text-muted-foreground">
        No cover
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={`${title} cover`}
      className="h-14 w-10 shrink-0 rounded-md border border-border/75 bg-muted object-cover shadow-sm"
      loading="lazy"
    />
  );
}

function CopyImagesCell({ images }: { images: CatalogCopyImageRecord[] }) {
  if (images.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  // Images are ordered by the uploader via `sort_order`; the first one is the
  // canonical thumbnail. Show up to three overlapping thumbs and a "+N" badge
  // when there are more, to keep the row compact.
  const ordered = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const visible = ordered.slice(0, 3);
  const overflow = ordered.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((image) => (
        <img
          key={image.id}
          src={image.image_url}
          alt=""
          className="h-10 w-10 rounded-md border border-border/75 bg-muted object-cover shadow-sm"
          loading="lazy"
        />
      ))}
      {overflow > 0 && (
        <span className="relative z-10 inline-flex h-10 items-center rounded-md border border-border/75 bg-background px-2 text-xs font-medium text-muted-foreground">
          +{overflow}
        </span>
      )}
    </div>
  );
}

export function CopiesWorkspace() {
  const { openFlow } = useAdminFlow();
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
        return [
          copy.edition?.book?.title?.toLowerCase() ?? "",
          copy.edition?.isbn?.toLowerCase() ?? "",
          copy.user_id.toLowerCase(),
          (memberNamesById.get(copy.user_id) ?? "").toLowerCase(),
        ].some((v) => v.includes(normalizedQuery));
      })
      .sort((a, b) => {
        switch (sort) {
          case "title_asc":
            return (a.edition?.book?.title ?? "").localeCompare(b.edition?.book?.title ?? "", undefined, { sensitivity: "base" });
          case "status_asc":
            return a.status.localeCompare(b.status, undefined, { sensitivity: "base" });
          default:
            return b.created_at.localeCompare(a.created_at);
        }
      });
  }, [copies, memberNamesById, query, sort, statusFilter]);

  return (
    <section className="space-y-8">
      <PageIntro
        title="Copies"
        description="Member-owned inventory rows currently in the system."
        actions={
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="rounded-full px-4" asChild>
              <Link href="/catalog">
                <ArrowLeft className="h-4 w-4" />
                Back to Catalog
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-4"
              onClick={() => openFlow({ kind: "add-copy" })}
            >
              <Plus className="h-4 w-4" />
              Add New Copy
            </Button>
          </div>
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
            <Badge variant="secondary" className="border border-border/75 bg-background px-3 py-1 text-muted-foreground">
              {filtered.length} shown
            </Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, ISBN, member, or user ID"
            />
            <Select value={sort} onChange={(e) => setSort(e.target.value as CopiesSort)}>
              <option value="latest_desc">Sort: Latest</option>
              <option value="title_asc">Sort: Title</option>
              <option value="status_asc">Sort: Status</option>
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Status: All</option>
              {availableStatuses.map((v) => (
                <option key={v} value={v}>Status: {v}</option>
              ))}
            </Select>
          </div>

          {copiesQuery.isError ? (
            <p className="text-sm text-red-700">
              {copiesQuery.error instanceof Error ? copiesQuery.error.message : "Failed to load copies."}
            </p>
          ) : copiesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading copies…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No copies match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Images</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Share Type</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((copy) => (
                  <TableRow key={copy.id} className="group">
                    <TableCell className="min-w-[260px] whitespace-normal">
                      <div className="flex items-start gap-3">
                        <EditionCoverThumb
                          url={copy.edition?.cover_image_url ?? null}
                          title={copy.edition?.book?.title ?? "Untitled"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            {copy.edition?.book?.title ?? "Untitled"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {copy.edition?.isbn || "No ISBN"}
                          </p>
                          <CopyRowActions copy={copy} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CopyImagesCell images={copy.images ?? []} />
                    </TableCell>
                    <TableCell>{memberNamesById.get(copy.user_id) ?? copy.user_id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{copy.status}</Badge>
                    </TableCell>
                    <TableCell>{copy.share_type || "—"}</TableCell>
                    <TableCell>{formatDate(copy.created_at)}</TableCell>
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
