"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ArrowLeft, Edit, Loader2, Plus } from "lucide-react";
import {
  useCatalogWishes,
  useAdminArchiveWish,
  useAdminRestoreWish,
  type CatalogWishRecord,
} from "@/domain/catalog/queries";
import { useMemberDirectory } from "@/domain/members/queries";
import { useAdminFlow } from "@/flows/admin-flow-provider";
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

type WishesSort = "latest_desc" | "title_asc" | "status_asc";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function WishRowActions({ wish }: { wish: CatalogWishRecord }) {
  const { openFlow } = useAdminFlow();
  const [rowError, setRowError] = useState<string | null>(null);

  const archiveMutation = useAdminArchiveWish();
  const restoreMutation = useAdminRestoreWish();
  const busy = archiveMutation.isPending || restoreMutation.isPending;

  const canArchive = wish.status === "active";
  const canRestore = wish.status === "cancelled";

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

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => openFlow({ kind: "edit-wish", wish })}
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
            onClick={handleArchive}
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

        {canRestore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleRestore}
            disabled={busy}
          >
            {restoreMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArchiveRestore className="h-4 w-4" />
            )}
            Restore
          </Button>
        )}
      </div>

      {rowError && <p className="mt-1 text-xs text-red-700">{rowError}</p>}
    </>
  );
}

export function WishesWorkspace() {
  const { openFlow } = useAdminFlow();
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
        return [
          wish.book?.title?.toLowerCase() ?? "",
          wish.edition?.isbn?.toLowerCase() ?? "",
          wish.user_id.toLowerCase(),
          (memberNamesById.get(wish.user_id) ?? "").toLowerCase(),
        ].some((v) => v.includes(normalizedQuery));
      })
      .sort((a, b) => {
        switch (sort) {
          case "title_asc":
            return (a.book?.title ?? "").localeCompare(b.book?.title ?? "", undefined, { sensitivity: "base" });
          case "status_asc":
            return a.status.localeCompare(b.status, undefined, { sensitivity: "base" });
          default:
            return b.created_at.localeCompare(a.created_at);
        }
      });
  }, [memberNamesById, query, sort, statusFilter, wishes]);

  return (
    <section className="space-y-8">
      <PageIntro
        title="Wishes"
        description="Member wishes currently stored in the platform."
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
              onClick={() => openFlow({ kind: "add-wish" })}
            >
              <Plus className="h-4 w-4" />
              Add New Want
            </Button>
          </div>
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
            <Select value={sort} onChange={(e) => setSort(e.target.value as WishesSort)}>
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

          {wishesQuery.isError ? (
            <p className="text-sm text-red-700">
              {wishesQuery.error instanceof Error ? wishesQuery.error.message : "Failed to load wishes."}
            </p>
          ) : wishesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading wishes…</p>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((wish) => (
                  <TableRow key={wish.id} className="group">
                    <TableCell className="min-w-[200px] whitespace-normal">
                      <p className="font-medium text-foreground">
                        {wish.book?.title ?? "Untitled"}
                      </p>
                      {wish.book?.subtitle && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{wish.book.subtitle}</p>
                      )}
                      <WishRowActions wish={wish} />
                    </TableCell>
                    <TableCell>{memberNamesById.get(wish.user_id) ?? wish.user_id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{wish.status}</Badge>
                    </TableCell>
                    <TableCell>{wish.edition?.isbn || "Any edition"}</TableCell>
                    <TableCell>{formatDate(wish.created_at)}</TableCell>
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
