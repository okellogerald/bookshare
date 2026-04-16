"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCatalogEditions } from "@/domain/catalog/queries";
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

        const haystacks = [
          edition.book?.title?.toLowerCase() ?? "",
          edition.book?.subtitle?.toLowerCase() ?? "",
          edition.isbn?.toLowerCase() ?? "",
          edition.publisher?.toLowerCase() ?? "",
        ];

        return haystacks.some((value) => value.includes(normalizedQuery));
      })
      .sort((left, right) => {
        switch (sort) {
          case "title_asc":
            return (left.book?.title ?? "").localeCompare(right.book?.title ?? "", undefined, {
              sensitivity: "base",
            });
          case "year_desc":
            return (
              (right.published_year ?? 0) - (left.published_year ?? 0) ||
              right.created_at.localeCompare(left.created_at)
            );
          case "latest_desc":
          default:
            return right.created_at.localeCompare(left.created_at);
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
              placeholder="Search editions by title, subtitle, ISBN, or publisher"
            />
            <Select value={sort} onChange={(event) => setSort(event.target.value as EditionsSort)}>
              <option value="latest_desc">Sort: Latest</option>
              <option value="title_asc">Sort: Title</option>
              <option value="year_desc">Sort: Published Year</option>
            </Select>
            <Select value={formatFilter} onChange={(event) => setFormatFilter(event.target.value)}>
              <option value="all">Format: All</option>
              {availableFormats.map((value) => (
                <option key={value} value={value}>
                  Format: {value.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>

          {editionsQuery.isError ? (
            <p className="text-sm text-red-700">
              {editionsQuery.error instanceof Error
                ? editionsQuery.error.message
                : "Failed to load editions."}
            </p>
          ) : editionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading editions...</p>
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
                      <p className="font-medium text-foreground">
                        {edition.book?.title ?? "Untitled"}
                      </p>
                      {edition.book?.subtitle ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {edition.book.subtitle}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {edition.cover_image_url ? (
                        <img
                          src={edition.cover_image_url}
                          alt=""
                          className="h-10 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-8 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                          —
                        </div>
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
