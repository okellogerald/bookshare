"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCatalogCopies } from "@/domain/catalog/queries";
import { useMemberDirectory } from "@/domain/members/queries";
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
