"use client";

import { useState } from "react";
import Link from "next/link";
import type { PgWantWithBook } from "@/shared/api";
import { Button } from "@/shared/components/ui/button";
import { BookDetailsDialog } from "@/shared/components/book-details-dialog";
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
import { useMyWants, useConfirmWant, useDeleteWant } from "@/shared/queries/my-wants";

function isStale(lastConfirmedAt: string | null): boolean {
  if (!lastConfirmedAt) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastConfirmedAt).getTime() > thirtyDaysMs;
}

export default function MyWantsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWant, setSelectedWant] = useState<PgWantWithBook | null>(null);

  const { data: wants, isLoading } = useMyWants();
  const confirmWant = useConfirmWant();
  const deleteWant = useDeleteWant();
  const activeWants = (wants ?? []).filter((want) => want.status === "active");
  const fulfilledWants = (wants ?? []).filter(
    (want) => want.status === "fulfilled"
  );

  function handleOpenBookDetails(want: PgWantWithBook) {
    setSelectedWant(want);
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

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !wants?.length ? (
        <p className="text-muted-foreground">
          You haven&apos;t posted any wants yet.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Active Wants</h2>
            {!activeWants.length ? (
              <p className="text-sm text-muted-foreground">No active wants.</p>
            ) : (
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
                  {activeWants.map((want) => {
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
                                  Edit Book Details
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
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Fulfilled Wants</h2>
            {!fulfilledWants.length ? (
              <p className="text-sm text-muted-foreground">No fulfilled wants yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Book</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Fulfilled</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fulfilledWants.map((want) => (
                    <TableRow key={want.id}>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => handleOpenBookDetails(want)}
                          className="text-left underline-offset-4 hover:underline"
                        >
                          {want.book?.title ?? want.book_id}
                        </button>
                      </TableCell>
                      <TableCell>{want.notes || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {want.fulfilled_at
                          ? new Date(want.fulfilled_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/my-wants/${want.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            Edit Book Details
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      <BookDetailsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bookId={selectedWant?.book_id ?? null}
        fallbackTitle={selectedWant?.book?.title ?? selectedWant?.book_id}
        fallbackSubtitle={selectedWant?.book?.subtitle}
      >
        {selectedWant?.notes && (
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Your note
            </p>
            <p className="mt-1 text-sm">{selectedWant.notes}</p>
          </div>
        )}
      </BookDetailsDialog>
    </div>
  );
}
