"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PgWantWithBook } from "@/shared/api";
import { Button } from "@/shared/components/ui/button";
import { PaginationControls } from "@/shared/components/pagination-controls";
import { WishlistBookDialog } from "@/shared/components/wishlist-book-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
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
import { formatUiDate } from "@/shared/lib/date";
import {
  useMyWants,
  useConfirmWant,
  useDeleteWant,
} from "@/domains/wishlist/queries";

const pageSize = 24;

type ActiveWishSortOption =
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc"
  | "confirmed_desc";

function isStale(lastConfirmedAt: string | null): boolean {
  if (!lastConfirmedAt) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastConfirmedAt).getTime() > thirtyDaysMs;
}

export default function MyWishlistPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWant, setSelectedWant] = useState<PgWantWithBook | null>(null);
  const [activeSort, setActiveSort] =
    useState<ActiveWishSortOption>("created_desc");
  const [activePage, setActivePage] = useState(1);

  const { data: wants, isLoading } = useMyWants();
  const confirmWant = useConfirmWant();
  const deleteWant = useDeleteWant();

  const activeWants = useMemo(() => {
    const items = [...(wants ?? [])];
    items.sort((left, right) => {
      switch (activeSort) {
        case "created_asc":
          return left.created_at.localeCompare(right.created_at);
        case "title_asc":
          return (
            (left.book?.title ?? left.book_id).localeCompare(
              right.book?.title ?? right.book_id,
              undefined,
              { sensitivity: "base" }
            ) || right.created_at.localeCompare(left.created_at)
          );
        case "title_desc":
          return (
            (right.book?.title ?? right.book_id).localeCompare(
              left.book?.title ?? left.book_id,
              undefined,
              { sensitivity: "base" }
            ) || right.created_at.localeCompare(left.created_at)
          );
        case "confirmed_desc":
          return (right.last_confirmed_at ?? right.created_at).localeCompare(
            left.last_confirmed_at ?? left.created_at
          );
        case "created_desc":
        default:
          return right.created_at.localeCompare(left.created_at);
      }
    });
    return items;
  }, [activeSort, wants]);

  const activeTotalPages = Math.max(1, Math.ceil(activeWants.length / pageSize));
  const pagedActiveWants = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return activeWants.slice(start, start + pageSize);
  }, [activePage, activeWants]);

  useEffect(() => {
    if (activePage > activeTotalPages) {
      setActivePage(activeTotalPages);
    }
  }, [activePage, activeTotalPages]);

  useEffect(() => {
    setActivePage(1);
  }, [activeSort]);

  function handleOpenBookDetails(want: PgWantWithBook) {
    setSelectedWant(want);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Wishlist</h1>
          <p className="text-muted-foreground">
            Books you&apos;re looking for
          </p>
        </div>
        <Link href="/my-wishlist/add">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Wish
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !activeWants.length ? (
        <p className="text-muted-foreground">No wishes yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Wishes</h2>
            <Select
              value={activeSort}
              onValueChange={(value) => setActiveSort(value as ActiveWishSortOption)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Newest added</SelectItem>
                <SelectItem value="created_asc">Oldest added</SelectItem>
                <SelectItem value="confirmed_desc">Recently confirmed</SelectItem>
                <SelectItem value="title_asc">Title A-Z</SelectItem>
                <SelectItem value="title_desc">Title Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Notes</TableHead>
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
                      {stale && (
                        <Badge
                          variant="outline"
                          className="mt-2 border-amber-600 text-amber-600"
                        >
                          Needs confirmation
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate">
                      {want.notes || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatUiDate(want.created_at)}
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
                            <Link href={`/my-wishlist/${want.id}/edit`}>
                              Edit Wish
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => confirmWant.mutate(want.id)}
                          >
                            Confirm Still Looking
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
        </div>
      )}

      <WishlistBookDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        want={selectedWant}
      />
    </div>
  );
}
