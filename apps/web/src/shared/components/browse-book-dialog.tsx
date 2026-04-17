"use client";

import Link from "next/link";
import type { BrowseEditionListing } from "@/domains/browse/queries";
import {
  useBookDetail,
  useEditionsByBook,
  useListingsByBook,
} from "@/domains/books/queries";
import { BookDialogHero } from "@/shared/components/book-dialog-hero";
import { CommunityCopyList } from "@/shared/components/community-copy-list";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/shared/components/ui/dialog";

interface BrowseBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: BrowseEditionListing | null;
  isAuthenticated: boolean;
  alreadyInMyWants: boolean;
  alreadyInMyLibrary: boolean;
  myWantsLoading: boolean;
  activeOwnedBooksLoading: boolean;
  createWantPending: boolean;
  deleteWantPending: boolean;
  addWantError: string | null;
  onAddToWants: () => void;
  onRemoveInterest: () => void;
}

export function BrowseBookDialog({
  open,
  onOpenChange,
  listing,
  isAuthenticated,
  alreadyInMyWants,
  alreadyInMyLibrary,
  myWantsLoading,
  activeOwnedBooksLoading,
  createWantPending,
  deleteWantPending,
  addWantError,
  onAddToWants,
  onRemoveInterest,
}: BrowseBookDialogProps) {
  const bookId = listing?.book_id ?? "";
  const { data: book } = useBookDetail(bookId);
  const { data: editions } = useEditionsByBook(bookId);
  const { data: listings, isLoading: listingsLoading } = useListingsByBook(bookId);

  const title = book?.title ?? listing?.book_title ?? "Book";
  const subtitle = book?.subtitle ?? listing?.book_subtitle ?? null;
  const authors =
    book?.authors?.map((author) => author.name).join(", ") ??
    listing?.authors?.map((author) => author.name).join(", ") ??
    null;
  const imageUrl =
    listing?.cover_image_url ??
    (listing?.edition_id
      ? editions?.find((edition) => edition.id === listing.edition_id)?.cover_image_url
      : null) ??
    editions?.find((edition) => edition.cover_image_url)?.cover_image_url ??
    null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {!listing ? (
          <p className="text-sm text-muted-foreground">
            Select a book to view details.
          </p>
        ) : (
          <>
            <BookDialogHero
              title={title}
              subtitle={subtitle}
              authors={authors}
              imageUrl={imageUrl}
            />

            <CommunityCopyList
              title="Available From Members"
              listings={listings}
              isLoading={listingsLoading}
              emptyMessage="No community copies are available right now."
            />

            <DialogFooter>
              <div className="w-full space-y-2">
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/books/${listing.book_id}`}>View Book Details</Link>
                </Button>
                {!isAuthenticated ? (
                  <Button asChild className="w-full">
                    <Link href="/api/auth/login?returnTo=/browse">
                      Sign In to Add to Wants
                    </Link>
                  </Button>
                ) : alreadyInMyWants ? (
                  <Button
                    variant="outline"
                    onClick={onRemoveInterest}
                    disabled={myWantsLoading || deleteWantPending}
                    className="w-full"
                  >
                    {myWantsLoading
                      ? "Checking..."
                      : deleteWantPending
                        ? "Removing..."
                        : "Remove Interest"}
                  </Button>
                ) : (
                  <Button
                    onClick={onAddToWants}
                    disabled={
                      myWantsLoading ||
                      activeOwnedBooksLoading ||
                      alreadyInMyLibrary ||
                      createWantPending
                    }
                    className="w-full"
                  >
                    {myWantsLoading || activeOwnedBooksLoading
                      ? "Checking..."
                      : alreadyInMyLibrary
                        ? "Already in My Library"
                        : createWantPending
                          ? "Adding..."
                          : "Add to My Wishlist"}
                  </Button>
                )}
                {addWantError ? (
                  <p className="text-xs text-destructive">{addWantError}</p>
                ) : null}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
