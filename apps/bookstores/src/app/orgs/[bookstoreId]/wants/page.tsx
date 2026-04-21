"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { BookstoreStatus } from "@bookshare/shared";
import {
  useBookstore,
  useBookstoreWants,
} from "@/domain/bookstores/queries";
import { BookstoreStatusBanner } from "@/shared/components/bookstore-status";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
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
import { formatUiDateTime } from "@/shared/lib/date";

export default function BookstoreWantsPage() {
  const params = useParams<{ bookstoreId: string }>();
  const router = useRouter();
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
          <Link href={`/orgs/${bookstore.id}/profile`}>Open profile</Link>
        </Button>
      </div>
    );
  }

  const wants = wantsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.04em]">
          Active wants
        </h1>
        <p className="text-sm text-muted-foreground">
          Search active wants, inspect the wanter, and send one active proposal per want.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.2fr_0.4fr_0.4fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-11"
              placeholder="Search by title, author, ISBN, wanter, or location"
            />
          </div>
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
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
          >
            <option value="latest_activity_desc">Newest activity</option>
            <option value="oldest_created_asc">Oldest created</option>
            <option value="title_asc">Title</option>
          </Select>
        </div>

        {wantsQuery.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center border-t text-muted-foreground">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            Loading active wants…
          </div>
        ) : wantsQuery.error ? (
          <div className="border-t px-4 py-3 text-sm text-red-700">
            {(wantsQuery.error as Error).message}
          </div>
        ) : wants.length === 0 ? (
          <div className="flex min-h-[24vh] flex-col items-center justify-center gap-2 border-t p-6 text-center">
            <p className="font-display text-lg font-semibold tracking-[-0.03em]">
              No active wants match this view
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Adjust the search or filters to widen the results.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Wanter</TableHead>
                <TableHead>Latest activity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wants.map((want) => (
                <TableRow
                  key={want.id}
                  onClick={() =>
                    router.push(`/orgs/${bookstore.id}/wants/${want.id}`)
                  }
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {want.book.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={want.book.coverImageUrl}
                            alt={want.book.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="px-1 text-center text-[10px] text-muted-foreground">
                            No cover
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display truncate text-sm font-medium tracking-[-0.025em]">
                          {want.book.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {want.book.authors.length > 0
                            ? want.book.authors.join(", ")
                            : "Author not specified"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-sm">{want.wanter.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {want.wanter.location || "Location not shared"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatUiDateTime(want.latestActivityAt)}
                  </TableCell>
                  <TableCell>
                    {want.activeProposal ? (
                      <Badge>Proposal active</Badge>
                    ) : (
                      <Badge variant="secondary">Open</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
