"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Edit, Loader2, Plus, Trash } from "lucide-react";
import {
  useCatalogBooks,
  useAdminDeleteBook,
} from "@/domain/catalog/queries";
import { useAdminFlow } from "@/flows/admin-flow-provider";
import type { PgBookWithAuthorsView } from "@/shared/api";
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

type TitlesSort = "title_asc" | "title_desc";

function TitleRowActions({ book }: { book: PgBookWithAuthorsView }) {
  const { openFlow } = useAdminFlow();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useAdminDeleteBook();

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => openFlow({ kind: "edit-book", book })}
        >
          <Edit className="h-4 w-4" />
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs text-red-700 hover:border-red-300 hover:bg-red-50"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete book?"
        description={`"${book.title}" and all its data will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteMutation.mutateAsync(book.id);
          setConfirmDelete(false);
        }}
        onCancel={() => setConfirmDelete(false)}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}

export function TitlesWorkspace() {
  const booksQuery = useCatalogBooks(200);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TitlesSort>("title_asc");

  const books = booksQuery.data ?? [];

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...books]
      .filter((book) => {
        if (!normalizedQuery) return true;
        return [
          book.title.toLowerCase(),
          (book.subtitle ?? "").toLowerCase(),
          book.authors.map((a) => a.name.toLowerCase()).join(" "),
        ].some((v) => v.includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (sort === "title_desc")
          return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      });
  }, [books, query, sort]);

  return (
    <section className="space-y-8">
      <PageIntro
        title="Titles"
        description="All book records currently stored in the catalog."
        actions={
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="rounded-full px-4">
              <Link href="/catalog">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              Back to Catalog
            </Button>
            <Button type="button" variant={"outline"} className="rounded-full px-4">
                <Plus className="h-4 w-4" />
                Add New Title
            </Button>
          </div>
        }
      />

      <Card className="border-border/75 bg-card/[0.92]">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Book records</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse and search titles in the catalog.
              </p>
            </div>
            <Badge variant="secondary" className="border border-border/75 bg-background px-3 py-1 text-muted-foreground">
              {filtered.length} shown
            </Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, subtitle, or author"
            />
            <Select value={sort} onChange={(e) => setSort(e.target.value as TitlesSort)}>
              <option value="title_asc">Sort: Title A–Z</option>
              <option value="title_desc">Sort: Title Z–A</option>
            </Select>
          </div>

          {booksQuery.isError ? (
            <p className="text-sm text-red-700">
              {booksQuery.error instanceof Error ? booksQuery.error.message : "Failed to load titles."}
            </p>
          ) : booksQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading titles…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No titles match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Authors</TableHead>
                  <TableHead>Language</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((book) => (
                  <TableRow key={book.id}>
                    <TableCell className="min-w-[200px] whitespace-normal">
                      <p className="font-medium text-foreground">{book.title}</p>
                      {book.subtitle && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{book.subtitle}</p>
                      )}
                      <TitleRowActions book={book} />
                    </TableCell>
                    <TableCell>
                      {book.authors.length > 0 ? book.authors.map((a) => a.name).join(", ") : "—"}
                    </TableCell>
                    <TableCell>{book.language || "—"}</TableCell>
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
