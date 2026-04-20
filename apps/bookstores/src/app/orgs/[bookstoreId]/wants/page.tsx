"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { BookstoreStatus } from "@bookshare/shared";
import {
  useBookstore,
  useBookstoreWants,
} from "@/domain/bookstores/queries";
import { BookstoreStatusBanner, BookstoreStatusBadge } from "@/shared/components/bookstore-status";
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
import { Select } from "@/shared/components/ui/select";
import { formatUiDateTime } from "@/shared/lib/date";

export default function BookstoreWantsPage() {
  const params = useParams<{ bookstoreId: string }>();
  const bookstoreId = params.bookstoreId;
  const [search, setSearch] = useState("");
  const [proposalState, setProposalState] = useState<"all" | "not_proposed" | "proposed">("all");
  const [sort, setSort] = useState<
    "latest_activity_desc" | "oldest_created_asc" | "title_asc"
  >("latest_activity_desc");
  const deferredSearch = useDeferredValue(search);

  const bookstoreQuery = useBookstore(bookstoreId);
  const wantsQuery = useBookstoreWants(
    bookstoreId,
    {
      search: deferredSearch,
      proposalState,
      sort,
    },
    {
      enabled: bookstoreQuery.data?.status === BookstoreStatus.APPROVED,
    }
  );

  if (bookstoreQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading bookstore…
      </div>
    );
  }

  if (bookstoreQuery.error || !bookstoreQuery.data) {
    return (
      <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {(bookstoreQuery.error as Error | null)?.message || "Bookstore not found."}
      </div>
    );
  }

  const bookstore = bookstoreQuery.data;

  if (bookstore.status !== BookstoreStatus.APPROVED) {
    return (
      <div className="space-y-4">
        <BookstoreStatusBanner status={bookstore.status} reviewNote={bookstore.reviewNote} />
        <Button asChild variant="outline">
          <Link href={`/orgs/${bookstore.id}/settings`}>Open settings</Link>
        </Button>
      </div>
    );
  }

  const wants = wantsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.04em]">
            Active wants
          </h1>
          <BookstoreStatusBadge status={bookstore.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Search active wants, inspect the wanter, and send one active proposal per want.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Search by title, author, ISBN, wanter name, or location.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.4fr_0.4fr]">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-11"
                placeholder="Book title, author, ISBN, wanter, or location"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Proposal state
            </label>
            <Select
              value={proposalState}
              onChange={(event) =>
                setProposalState(event.target.value as typeof proposalState)
              }
            >
              <option value="all">All wants</option>
              <option value="not_proposed">Not yet proposed</option>
              <option value="proposed">Proposed by this bookstore</option>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Sort
            </label>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
            >
              <option value="latest_activity_desc">Newest activity</option>
              <option value="oldest_created_asc">Oldest created</option>
              <option value="title_asc">Title</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {wantsQuery.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading active wants…
        </div>
      ) : wantsQuery.error ? (
        <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(wantsQuery.error as Error).message}
        </div>
      ) : wants.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[24vh] flex-col items-center justify-center gap-3 text-center">
            <p className="font-display text-xl font-semibold tracking-[-0.03em]">
              No active wants match this view
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Adjust the search or filters to widen the results.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {wants.map((want) => (
            <Card key={want.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex h-full flex-col gap-5 p-6 sm:flex-row">
                  <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.2rem] bg-muted">
                    {want.book.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={want.book.coverImageUrl}
                        alt={want.book.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="px-3 text-center text-xs text-muted-foreground">
                        No cover
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-lg font-semibold tracking-[-0.03em]">
                          {want.book.title}
                        </p>
                        {want.activeProposal ? (
                          <Badge>Proposal active</Badge>
                        ) : (
                          <Badge variant="secondary">Open</Badge>
                        )}
                      </div>
                      {want.book.subtitle ? (
                        <p className="text-sm text-muted-foreground">
                          {want.book.subtitle}
                        </p>
                      ) : null}
                      <p className="text-sm text-muted-foreground">
                        {want.book.authors.length > 0
                          ? want.book.authors.join(", ")
                          : "Author not specified"}
                      </p>
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Wanter
                        </p>
                        <p>{want.wanter.displayName}</p>
                        <p className="text-muted-foreground">
                          {want.wanter.location || "Location not shared"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Latest activity
                        </p>
                        <p>{formatUiDateTime(want.latestActivityAt)}</p>
                        <p className="text-muted-foreground">
                          {want.book.primaryIsbn
                            ? `ISBN ${want.book.primaryIsbn}`
                            : "No ISBN listed"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {want.activeProposal?.message
                          ? "Proposal includes a note."
                          : want.activeProposal
                            ? "Proposal sent without a note."
                            : "No proposal sent yet."}
                      </p>
                      <Button asChild variant="outline">
                        <Link href={`/orgs/${bookstore.id}/wants/${want.id}`}>
                          View want
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
