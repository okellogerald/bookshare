"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCatalogWishes } from "@/domain/catalog/queries";
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

type WishesSort = "latest_desc" | "title_asc" | "status_asc";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

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
