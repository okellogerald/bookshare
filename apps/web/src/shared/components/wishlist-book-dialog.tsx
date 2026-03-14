"use client";

import Link from "next/link";
import type { PgWantWithBook } from "@/shared/api";
import {
  useBookDetail,
  useEditionsByBook,
  useListingsByBook,
} from "@/shared/queries/books";
import { BookDialogHero } from "@/shared/components/book-dialog-hero";
import { CommunityCopyList } from "@/shared/components/community-copy-list";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { formatUiDate } from "@/shared/lib/date";

function isStale(lastConfirmedAt: string | null): boolean {
  if (!lastConfirmedAt) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastConfirmedAt).getTime() > thirtyDaysMs;
}

interface WishlistBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  want: PgWantWithBook | null;
}

export function WishlistBookDialog({
  open,
  onOpenChange,
  want,
}: WishlistBookDialogProps) {
  const bookId = want?.book_id ?? "";
  const { data: book } = useBookDetail(bookId);
  const { data: editions } = useEditionsByBook(bookId);
  const { data: listings, isLoading: listingsLoading } = useListingsByBook(bookId);

  const title = book?.title ?? want?.book?.title ?? "Book";
  const subtitle = book?.subtitle ?? want?.book?.subtitle ?? null;
  const authors = book?.authors?.map((author) => author.name).join(", ") ?? null;
  const coverImageUrl =
    listings?.find((listing) => listing.cover_image_url)?.cover_image_url ??
    editions?.find((edition) => edition.cover_image_url)?.cover_image_url ??
    null;
  const stale = want ? isStale(want.last_confirmed_at) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {!want ? (
          <p className="text-sm text-muted-foreground">
            Select a wish to view details.
          </p>
        ) : (
          <>
            <BookDialogHero
              title={title}
              subtitle={subtitle}
              authors={authors}
              imageUrl={coverImageUrl}
            >
              {stale ? (
                <Badge
                  variant="outline"
                  className="border-amber-600 text-amber-600"
                >
                  Needs confirmation
                </Badge>
              ) : null}
            </BookDialogHero>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Your note
                </p>
                <p className="text-sm">
                  {want.notes?.trim() ? want.notes : "No note added."}
                </p>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tracking
                </p>
                <p className="text-sm text-muted-foreground">
                  Added {formatUiDate(want.created_at)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Last confirmed{" "}
                  {want.last_confirmed_at
                    ? formatUiDate(want.last_confirmed_at)
                    : "not yet"}
                </p>
              </div>
            </div>

            <CommunityCopyList
              title="Available From Members"
              listings={listings}
              isLoading={listingsLoading}
              emptyMessage="No community copies are available for this book right now."
            />

            <DialogFooter>
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline" className="sm:flex-1">
                  <Link href={`/books/${want.book_id}`}>View Book Details</Link>
                </Button>
                <Button asChild className="sm:flex-1">
                  <Link href={`/my-wishlist/${want.id}/edit`}>Edit Wish</Link>
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
