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
import { Separator } from "@/shared/components/ui/separator";
import {
  useBookCategories,
  useBookDetail,
  useEditionsByBook,
  useListingsByBook,
} from "@/shared/queries/books";
import { useAllCategories } from "@/shared/queries/my-library";

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
  lent: "Lent Out",
};

function getCategoryDisplayName(name: string) {
  const segments = name
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments[segments.length - 1] ?? name.trim();
}

interface BookDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string | null;
  focusEditionId?: string | null;
  hideEditionList?: boolean;
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
  const { data: allCategories } = useAllCategories();
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
      [...(listings ?? [])].sort((a, b) => {
        if (a.status === b.status) {
          return b.created_at.localeCompare(a.created_at);
        }
        if (a.status === "available") return -1;
        if (b.status === "available") return 1;
        return 0;
      }),
    [listings]
  );
  const listedEditionIds = useMemo(
    () => new Set(sortedListings.map((listing) => listing.edition_id)),
    [sortedListings]
  );
  const otherEditions = useMemo(
    () => (editions ?? []).filter((edition) => !listedEditionIds.has(edition.id)),
    [editions, listedEditionIds]
  );
  const visibleCategoryBadges = useMemo(() => {
    const categories = bookWithCategories?.categories ?? [];
    if (categories.length === 0) return [];

    const categoryIds = new Set(categories.map((category) => category.id));
    const parentByCategoryId = new Map(
      (allCategories ?? []).map((category) => [category.id, category.parent_id])
    );
    const parentIdsToHide = new Set<string>();

    for (const category of categories) {
      const parentId = parentByCategoryId.get(category.id) ?? null;
      if (parentId && categoryIds.has(parentId)) {
        parentIdsToHide.add(parentId);
      }
    }

    const seenLabels = new Set<string>();
    const normalized = categories
      .filter((category) => !parentIdsToHide.has(category.id))
      .map((category) => ({
        ...category,
        displayName: getCategoryDisplayName(category.name),
      }))
      .filter((category) => {
        const key = category.displayName.toLowerCase();
        if (seenLabels.has(key)) return false;
        seenLabels.add(key);
        return true;
      });

    return normalized.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [allCategories, bookWithCategories?.categories]);

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

            {book.language && (
              <Badge variant="outline">{book.language.toUpperCase()}</Badge>
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
                    <Badge key={category.id} variant="secondary">
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
              <p className="whitespace-pre-line text-sm leading-relaxed">{editionDescription}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No description provided.
              </p>
            )}

            {children}

            {!hideEditionList && (
              <>
                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Available Listings</h3>
                    {listingsLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <div key={index} className="h-16 animate-pulse rounded border bg-muted" />
                        ))}
                      </div>
                    ) : sortedListings.length > 0 ? (
                      <div className="space-y-2">
                        {sortedListings.map((listing) => (
                          <div key={listing.id} className="space-y-1 rounded border p-3">
                            <div className="flex flex-wrap gap-1.5">
                              <Badge
                                variant={listing.status === "available" ? "default" : "outline"}
                              >
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
                              In library of @{listing.owner_username ?? "member"}
                              {listing.owner_display_name
                                ? ` (${listing.owner_display_name})`
                                : ""}
                            </p>
                            {listing.status === "lent" && (
                              <p className="text-sm text-muted-foreground">
                                {listing.borrower_username
                                  ? `Currently with @${listing.borrower_username}`
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

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Other Editions</h3>
                    {editionsLoading || listingsLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <div key={index} className="h-14 animate-pulse rounded border bg-muted" />
                        ))}
                      </div>
                    ) : otherEditions.length > 0 ? (
                      <div className="space-y-2">
                        {otherEditions.map((edition) => (
                          <div key={edition.id} className="space-y-1 rounded border p-3">
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="secondary">
                                {formatLabels[edition.format] ?? edition.format}
                              </Badge>
                              {edition.isbn && (
                                <Badge variant="outline">ISBN: {edition.isbn}</Badge>
                              )}
                              {focusEditionId && edition.id === focusEditionId && (
                                <Badge variant="outline">Referenced edition</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {edition.publisher ?? "Unknown publisher"}
                              {edition.published_year ? ` • ${edition.published_year}` : ""}
                              {edition.page_count ? ` • ${edition.page_count} pages` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : editions && editions.length > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        All known editions already appear in available listings.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No edition information available.
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
