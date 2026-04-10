"use client";

import { useDeferredValue, useState } from "react";
import { Search } from "lucide-react";
import { useCatalogBookSearch } from "@/shared/queries/catalog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
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

export function CatalogWorkbench() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const booksQuery = useCatalogBookSearch(deferredQuery);
  const results = booksQuery.data ?? [];
  const showPrompt = deferredQuery.trim().length < 2;

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-background/70">
        <CardHeader>
          <CardTitle>Search the catalog</CardTitle>
          <CardDescription>
            Start with books already in the system before creating new records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title or subtitle"
                className="pl-11"
              />
            </div>
            <Button type="button" variant="secondary">
              New Book
            </Button>
          </div>

          {showPrompt ? (
            <p className="text-sm text-muted-foreground">
              Type at least two characters to search the current catalog.
            </p>
          ) : booksQuery.isError ? (
            <p className="text-sm text-red-700">
              {booksQuery.error instanceof Error
                ? booksQuery.error.message
                : "Catalog search failed."}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            Existing catalog matches for the current search term.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {booksQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Searching catalog...</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showPrompt
                ? "Search results will appear here."
                : "No matching books found in the catalog yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Authors</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Shape</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((book) => (
                  <TableRow key={book.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{book.title}</p>
                        {book.subtitle ? (
                          <p className="text-xs text-muted-foreground">
                            {book.subtitle}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatAuthors(book.authors)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {book.language || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {book.authors.length} author{book.authors.length === 1 ? "" : "s"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
