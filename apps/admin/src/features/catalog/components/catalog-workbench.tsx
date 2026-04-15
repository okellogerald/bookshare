"use client";

import { useDeferredValue, useState } from "react";
import { Search } from "lucide-react";
import {
  useCatalogBookSearch,
  useCatalogSummaryCounts,
} from "@/shared/queries/catalog";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

function formatAuthors(authors: Array<{ id: string; name: string }>) {
  if (authors.length === 0) return "Unknown author";
  return authors.map((author) => author.name).join(", ");
}

function formatSummaryValue(value: number | null | undefined, loading: boolean) {
  if (typeof value === "number") {
    return new Intl.NumberFormat().format(value);
  }

  return loading ? "..." : "—";
}

export function CatalogWorkbench() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const summaryQuery = useCatalogSummaryCounts();
  const booksQuery = useCatalogBookSearch(deferredQuery);
  const results = booksQuery.data ?? [];
  const showPrompt = deferredQuery.trim().length < 2;
  const summaryItems = [
    {
      label: "Titles",
      value: summaryQuery.data?.titles,
      detail: "Book records in the catalog.",
    },
    {
      label: "Editions",
      value: summaryQuery.data?.editions,
      detail: "Cataloged release records.",
    },
    {
      label: "Copies",
      value: summaryQuery.data?.copies,
      detail: "Inventory rows currently stored.",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        {summaryItems.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                {formatSummaryValue(item.value, summaryQuery.isLoading)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles by title or subtitle"
            className="pl-11"
          />
        </div>

        {showPrompt ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Type at least two characters to search the current catalog.
          </p>
        ) : booksQuery.isError ? (
          <p className="mt-3 text-sm text-red-700">
            {booksQuery.error instanceof Error
              ? booksQuery.error.message
              : "Catalog search failed."}
          </p>
        ) : null}
      </section>

      {!showPrompt ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Results</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Existing catalog matches for the current search term.
              </p>
            </div>
            <Badge
              variant="secondary"
              className="border border-border/75 bg-background px-3 py-1 text-muted-foreground"
            >
              {booksQuery.isLoading ? "Searching" : `${results.length} titles`}
            </Badge>
          </div>

          {booksQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Searching catalog...</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No matching books found in the catalog yet.
            </p>
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
                {results.map((book) => (
                  <TableRow key={book.id}>
                    <TableCell>
                      <p className="font-medium">{book.title}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatAuthors(book.authors)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {book.language || "Unknown"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      ) : null}
    </div>
  );
}
