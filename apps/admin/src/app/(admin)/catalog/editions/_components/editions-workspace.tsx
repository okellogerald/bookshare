"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  useCatalogEditions,
  useAdminDeleteEdition,
  type CatalogEditionRecord,
} from "@/domain/catalog/queries";
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

type EditionsSort = "latest_desc" | "title_asc" | "year_desc";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function EditionRowActions({ edition }: { edition: CatalogEditionRecord }) {
  const { openFlow } = useAdminFlow();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useAdminDeleteEdition();

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => openFlow({ kind: "edit-edition", edition })}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs text-red-700 hover:border-red-300 hover:bg-red-50"
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete edition?"
        description={`This edition of "${edition.book?.title ?? "unknown"}" will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteMutation.mutateAsync(edition.id);
          setConfirmDelete(false);
        }}
        onCancel={() => setConfirmDelete(false)}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}

export function EditionsWorkspace() {
  const editionsQuery = useCatalogEditions(200);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<EditionsSort>("latest_desc");
  const [formatFilter, setFormatFilter] = useState("all");

  const editions = editionsQuery.data ?? [];

  const availableFormats = useMemo(
    () => Array.from(new Set(editions.map((e) => e.format).filter(Boolean))).sort(),
    [editions]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...editions]
      .filter((edition) => {
        if (formatFilter !== "all" && edition.format !== formatFilter) return false;
        if (!normalizedQuery) return true;
        return [
          edition.book?.title?.toLowerCase() ?? "",
          edition.book?.subtitle?.toLowerCase() ?? "",
          edition.isbn?.toLowerCase() ?? "",
          edition.publisher?.toLowerCase() ?? "",
        ].some((v) => v.includes(normalizedQuery));
      })
      .sort((a, b) => {
        switch (sort) {
          case "title_asc":
            return (a.book?.title ?? "").localeCompare(b.book?.title ?? "", undefined, { sensitivity: "base" });
          case "year_desc":
            return (b.published_year ?? 0) - (a.published_year ?? 0) || b.created_at.localeCompare(a.created_at);
          default:
            return b.created_at.localeCompare(a.created_at);
        }
      });
  }, [editions, formatFilter, query, sort]);

  return (
    <section className="space-y-8">
      <PageIntro
        title="Editions"
        description="Cataloged edition records ready for operations."
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
              <h2 className="text-lg font-semibold text-foreground">Available editions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse editions with filtering, sorting, and search.
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
              placeholder="Search by title, ISBN, or publisher"
            />
            <Select value={sort} onChange={(e) => setSort(e.target.value as EditionsSort)}>
              <option value="latest_desc">Sort: Latest</option>
              <option value="title_asc">Sort: Title</option>
              <option value="year_desc">Sort: Year</option>
            </Select>
            <Select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
              <option value="all">Format: All</option>
              {availableFormats.map((v) => (
                <option key={v} value={v}>Format: {v.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </div>

          {editionsQuery.isError ? (
            <p className="text-sm text-red-700">
              {editionsQuery.error instanceof Error ? editionsQuery.error.message : "Failed to load editions."}
            </p>
          ) : editionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading editions…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No editions match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Cover</TableHead>
                  <TableHead>ISBN</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((edition) => (
                  <TableRow key={edition.id}>
                    <TableCell className="min-w-[200px] whitespace-normal">
                      <p className="font-medium text-foreground">{edition.book?.title ?? "Untitled"}</p>
                      {edition.book?.subtitle && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{edition.book.subtitle}</p>
                      )}
                      <EditionRowActions edition={edition} />
                    </TableCell>
                    <TableCell>
                      {edition.cover_image_url ? (
                        <img src={edition.cover_image_url} alt="" className="h-10 w-8 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-8 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">—</div>
                      )}
                    </TableCell>
                    <TableCell>{edition.isbn || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{edition.format.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>{edition.publisher || "—"}</TableCell>
                    <TableCell>{edition.published_year ?? "—"}</TableCell>
                    <TableCell>{formatDate(edition.created_at)}</TableCell>
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
