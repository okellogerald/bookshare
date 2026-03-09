"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PgFulfilledWantHistory, PgWantWithBook } from "@/shared/api";
import { Button } from "@/shared/components/ui/button";
import { BookDetailsDialog } from "@/shared/components/book-details-dialog";
import { PaginationControls } from "@/shared/components/pagination-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Badge } from "@/shared/components/ui/badge";
import { MoreHorizontal, Plus } from "lucide-react";
import { useCurrentUser } from "@/shared/providers/user-provider";
import {
  useMyWants,
  useConfirmWant,
  useDeleteWant,
  useFulfilledWantsHistory,
} from "@/shared/queries/my-wants";
import { FulfilledHistoryCard } from "./fulfilled-history-card";

const pageSize = 24;

function isStale(lastConfirmedAt: string | null): boolean {
  if (!lastConfirmedAt) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastConfirmedAt).getTime() > thirtyDaysMs;
}

export default function MyWantsPage() {
  const currentUser = useCurrentUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWant, setSelectedWant] = useState<PgWantWithBook | null>(null);
  const [selectedHistory, setSelectedHistory] =
    useState<PgFulfilledWantHistory | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [receivedPage, setReceivedPage] = useState(1);
  const [givenPage, setGivenPage] = useState(1);

  const { data: wants, isLoading } = useMyWants();
  const { data: fulfilledHistory, isLoading: historyLoading } =
    useFulfilledWantsHistory();
  const confirmWant = useConfirmWant();
  const deleteWant = useDeleteWant();
  const activeWants = (wants ?? []).filter((want) => want.status === "active");
  const receivedHistory = useMemo(
    () =>
      (fulfilledHistory ?? []).filter(
        (entry) => entry.recipient_user_id === currentUser?.id
      ),
    [currentUser?.id, fulfilledHistory]
  );
  const givenHistory = useMemo(
    () =>
      (fulfilledHistory ?? []).filter(
        (entry) => entry.fulfiller_user_id === currentUser?.id
      ),
    [currentUser?.id, fulfilledHistory]
  );
  const activeTotalPages = Math.max(1, Math.ceil(activeWants.length / pageSize));
  const receivedTotalPages = Math.max(
    1,
    Math.ceil(receivedHistory.length / pageSize)
  );
  const givenTotalPages = Math.max(
    1,
    Math.ceil(givenHistory.length / pageSize)
  );
  const pagedActiveWants = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return activeWants.slice(start, start + pageSize);
  }, [activePage, activeWants]);
  const pagedReceivedHistory = useMemo(() => {
    const start = (receivedPage - 1) * pageSize;
    return receivedHistory.slice(start, start + pageSize);
  }, [receivedHistory, receivedPage]);
  const pagedGivenHistory = useMemo(() => {
    const start = (givenPage - 1) * pageSize;
    return givenHistory.slice(start, start + pageSize);
  }, [givenHistory, givenPage]);

  useEffect(() => {
    if (activePage > activeTotalPages) {
      setActivePage(activeTotalPages);
    }
  }, [activePage, activeTotalPages]);

  useEffect(() => {
    if (receivedPage > receivedTotalPages) {
      setReceivedPage(receivedTotalPages);
    }
  }, [receivedPage, receivedTotalPages]);

  useEffect(() => {
    if (givenPage > givenTotalPages) {
      setGivenPage(givenTotalPages);
    }
  }, [givenPage, givenTotalPages]);

  function handleOpenBookDetails(want: PgWantWithBook) {
    setSelectedWant(want);
    setSelectedHistory(null);
    setDialogOpen(true);
  }

  function handleOpenHistoryDetails(entry: PgFulfilledWantHistory) {
    setSelectedWant(null);
    setSelectedHistory(entry);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Wants</h1>
          <p className="text-muted-foreground">
            Books you&apos;re looking for
          </p>
        </div>
        <Link href="/my-wants/add">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Want
          </Button>
        </Link>
      </div>

      {isLoading || historyLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !activeWants.length && !receivedHistory.length && !givenHistory.length ? (
        <p className="text-muted-foreground">
          No want history yet.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Active Wants</h2>
            {!activeWants.length ? (
              <p className="text-sm text-muted-foreground">No active wants.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Book</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedActiveWants.map((want) => {
                      const stale = isStale(want.last_confirmed_at);
                      return (
                        <TableRow key={want.id}>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            onClick={() => handleOpenBookDetails(want)}
                            className="text-left underline-offset-4 hover:underline"
                          >
                            {want.book?.title ?? want.book_id}
                          </button>
                          {want.book?.subtitle && (
                            <p className="text-xs text-muted-foreground">
                              {want.book.subtitle}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {want.notes || "—"}
                        </TableCell>
                        <TableCell>
                          {stale ? (
                            <Badge
                              variant="outline"
                              className="border-amber-600 text-amber-600"
                            >
                              Stale
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(want.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/my-wants/${want.id}/edit`}>
                                  Edit Want
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => confirmWant.mutate(want.id)}
                              >
                                Confirm Still Wanted
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteWant.mutate(want.id)}
                              >
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={activePage}
                  pageSize={pageSize}
                  totalItems={activeWants.length}
                  onPageChange={setActivePage}
                />
              </>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Books I Received</h2>
            {!receivedHistory.length ? (
              <p className="text-sm text-muted-foreground">
                No received history yet.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pagedReceivedHistory.map((entry) => (
                    <FulfilledHistoryCard
                      key={entry.want_id}
                      entry={entry}
                      perspective="received"
                      onOpenDetails={handleOpenHistoryDetails}
                    />
                  ))}
                </div>
                <PaginationControls
                  page={receivedPage}
                  pageSize={pageSize}
                  totalItems={receivedHistory.length}
                  onPageChange={setReceivedPage}
                />
              </>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Wants I Fulfilled</h2>
            {!givenHistory.length ? (
              <p className="text-sm text-muted-foreground">
                No fulfiller history yet.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pagedGivenHistory.map((entry) => (
                    <FulfilledHistoryCard
                      key={entry.want_id}
                      entry={entry}
                      perspective="given"
                      onOpenDetails={handleOpenHistoryDetails}
                    />
                  ))}
                </div>
                <PaginationControls
                  page={givenPage}
                  pageSize={pageSize}
                  totalItems={givenHistory.length}
                  onPageChange={setGivenPage}
                />
              </>
            )}
          </div>
        </div>
      )}

      <BookDetailsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bookId={selectedWant?.book_id ?? selectedHistory?.book_id ?? null}
        focusEditionId={
          selectedHistory?.fulfilled_edition_id ??
          selectedHistory?.wanted_edition_id ??
          null
        }
        fallbackTitle={
          selectedWant?.book?.title ??
          selectedHistory?.book_title ??
          selectedWant?.book_id
        }
        fallbackSubtitle={selectedWant?.book?.subtitle ?? selectedHistory?.book_subtitle}
        preferredImageUrl={
          selectedHistory?.fulfilled_edition_cover_image_url ??
          selectedHistory?.wanted_edition_cover_image_url
        }
      >
        {selectedWant?.notes && (
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Your note
            </p>
            <p className="mt-1 text-sm">{selectedWant.notes}</p>
          </div>
        )}
        {selectedHistory && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Exchange History
            </p>
            <p className="text-sm">
              <span className="font-medium">Wanter note:</span>{" "}
              {selectedHistory.wanter_notes || "No note provided."}
            </p>
            {selectedHistory.fulfillment_notes && (
              <p className="text-sm">
                <span className="font-medium">Recorded note:</span>{" "}
                {selectedHistory.fulfillment_notes}
              </p>
            )}
          </div>
        )}
      </BookDetailsDialog>
    </div>
  );
}
