"use client";

import { useMemo, type ReactNode } from "react";
import { Badge } from "@/shared/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { CommunityCopyList } from "@/shared/components/community-copy-list";
import { Separator } from "@/shared/components/ui/separator";
import {
  useBookCategories,
  useBookDetail,
  useEditionsByBook,
  useListingsByBook,
} from "@/domains/books/queries";

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

const shareTypeLabels: Record<string, string> = {
  lend: "Lend",
  sell: "Sell",
  give_away: "Give Away",
};

const conditionLabels: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

const listingStatusLabels: Record<string, string> = {
  available: "Available",
  lent: "Lent",
};

function getMemberName(firstName: string | null, lastName: string | null) {
  const fullName = [firstName, lastName]
    .filter((value): value is string => !!value && value.trim().length > 0)
    .join(" ")
    .trim();
  return fullName || "Community member";
}

interface BookDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string | null;
  focusEditionId?: string | null;
  hideEditionList?: boolean;
  compactCatalog?: boolean;
  fallbackTitle?: string;
  fallbackSubtitle?: string | null;
  preferredImageUrl?: string | null;
  children?: ReactNode;
  footer?: ReactNode;
}

export function BookDetailsDialog({
  open,
  onOpenChange,
  bookId,
  focusEditionId,
  hideEditionList = false,
  compactCatalog = false,
  fallbackTitle,
  fallbackSubtitle,
  preferredImageUrl,
  children,
  footer,
}: BookDetailsDialogProps) {
  const queryBookId = bookId ?? "";
  const { data: book, isLoading: bookLoading } = useBookDetail(queryBookId);
  const { data: bookWithCategories, isLoading: bookCategoriesLoading } =
    useBookCategories(queryBookId);
  const { data: editions, isLoading: editionsLoading } = useEditionsByBook(queryBookId);
  const { data: listings, isLoading: listingsLoading } = useListingsByBook(queryBookId);

  const title = book?.title ?? fallbackTitle ?? "Book details";
  const subtitle = book?.subtitle ?? fallbackSubtitle;
  const authors = book?.authors?.map((author) => author.name).join(", ");
  const fallbackCoverImage =
    (focusEditionId
      ? editions?.find((edition) => edition.id === focusEditionId)?.cover_image_url
      : null) ??
    editions?.find((edition) => edition.cover_image_url)?.cover_image_url ??
    null;
  const editionDescription =
    (focusEditionId
      ? editions?.find((edition) => edition.id === focusEditionId)?.description
      : null) ??
    editions?.find((edition) => edition.description)?.description ??
    null;
  const heroImageUrl = preferredImageUrl ?? fallbackCoverImage;
  const sortedListings = useMemo(
    () =>
      [...(listings ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [listings]
  );
  const editionCount = editions?.length ?? 0;
  const visibleCategoryBadges = useMemo(() => {
    const categories = bookWithCategories?.categories ?? [];
    if (categories.length === 0) return [];

    const seenLabels = new Set<string>();
    return categories
      .map((category) => ({
        ...category,
        displayName: category.name,
      }))
      .filter((category) => {
        const key = category.displayName.toLowerCase();
        if (seenLabels.has(key)) return false;
        seenLabels.add(key);
        return true;
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [bookWithCategories?.categories]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {heroImageUrl ? (
          <div className="mx-auto w-full max-w-[170px] sm:max-w-[210px]">
            <div className="aspect-[2/3] overflow-hidden rounded-md border bg-muted/30 p-2 shadow-sm">
              <img
                src={heroImageUrl}
                alt={title}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[170px] sm:max-w-[210px]">
            <div className="flex aspect-[2/3] items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
              No cover image available
            </div>
          </div>
        )}
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        {!bookId ? (
          <p className="text-sm text-muted-foreground">
            Select a book to view details.
          </p>
        ) : bookLoading ? (
          <div className="space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        ) : !book ? (
          <p className="text-sm text-muted-foreground">
            Could not load book details.
          </p>
        ) : (
          <div className="space-y-4">
            {authors && <p className="text-sm text-muted-foreground">By {authors}</p>}

            {!compactCatalog && (
              <>
                {book.language && (
                  <Badge variant="outline">{book.language.toUpperCase()}</Badge>
                )}
                {editionCount > 1 && (
                  <Badge variant="outline">{editionCount} editions</Badge>
                )}
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Categories
                  </p>
                  {bookCategoriesLoading ? (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-6 w-24 animate-pulse rounded-full bg-muted"
                        />
                      ))}
                    </div>
                  ) : visibleCategoryBadges.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {visibleCategoryBadges.map((category) => (
                        <Badge key={category.thema_code} variant="secondary">
                          {category.displayName}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No categories assigned.
                    </p>
                  )}
                </div>

                {editionsLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                  </div>
                ) : editionDescription ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed">
                    {editionDescription}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No description provided.
                  </p>
                )}
              </>
            )}

            {children}

            {!hideEditionList && (
              <>
                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">
                      {compactCatalog ? "Available From Members" : "Available Copies"}
                    </h3>
                    {!compactCatalog && editionCount > 1 ? (
                      <p className="text-xs text-muted-foreground">
                        Copies currently available across {editionCount} editions.
                      </p>
                    ) : null}
                    {compactCatalog ? (
                      <CommunityCopyList
                        listings={sortedListings}
                        isLoading={listingsLoading}
                        emptyMessage="No community copies are available right now."
                      />
                    ) : sortedListings.length > 0 ? (
                        <div className="space-y-2">
                          {sortedListings.map((listing) => (
                            <div key={listing.id} className="space-y-1 rounded border p-3">
                              <div className="flex flex-wrap gap-1.5">
                                <Badge variant="default">
                                  {listingStatusLabels[listing.status] ?? listing.status}
                                </Badge>
                                {listing.share_type && (
                                  <Badge variant="secondary">
                                    {shareTypeLabels[listing.share_type] ?? listing.share_type}
                                  </Badge>
                                )}
                                <Badge variant="secondary">
                                  {conditionLabels[listing.condition] ?? listing.condition}
                                </Badge>
                                <Badge variant="outline">
                                  {formatLabels[listing.format] ?? listing.format}
                                </Badge>
                                {listing.isbn && (
                                  <Badge variant="outline">ISBN: {listing.isbn}</Badge>
                                )}
                                {focusEditionId && listing.edition_id === focusEditionId && (
                                  <Badge variant="outline">Referenced edition</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                In library of{" "}
                                {getMemberName(
                                  listing.owner_first_name,
                                  listing.owner_last_name
                                )}
                              </p>
                              {listing.contact_note && (
                                <p className="text-sm text-muted-foreground">
                                  Contact note: {listing.contact_note}
                                </p>
                              )}
                              {listing.status === "lent" && (
                                <p className="text-sm text-muted-foreground">
                                  {listing.borrower_first_name || listing.borrower_last_name
                                    ? `Currently with ${getMemberName(
                                        listing.borrower_first_name,
                                        listing.borrower_last_name
                                      )}`
                                    : "Currently lent off-platform"}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No community listings for this book yet.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
