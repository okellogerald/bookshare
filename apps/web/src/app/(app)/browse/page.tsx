"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PgBrowseListing } from "@/shared/api";
import { BookDetailsDialog } from "@/shared/components/book-details-dialog";
import { PaginationControls } from "@/shared/components/pagination-controls";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useBrowseBookCategoryIndex, useBrowseListings } from "@/shared/queries/browse";
import { useCreateWant, useDeleteWant, useMyWants } from "@/shared/queries/my-wants";
import { useAllCategories, useMyActiveOwnedBookIds } from "@/shared/queries/my-library";
import { useCurrentUser } from "@/shared/providers/user-provider";
import { ListingCard } from "./listing-card";

const pageSize = 24;

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

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

export default function BrowsePage() {
  const [search, setSearch] = useState("");
  const [shareType, setShareType] = useState<string>("");
  const [condition, setCondition] = useState<string>("");
  const [format, setFormat] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [includeOwnListings, setIncludeOwnListings] = useState(false);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<PgBrowseListing | null>(null);
  const [addWantError, setAddWantError] = useState<string | null>(null);

  const { data: listings, isLoading } = useBrowseListings({
    search: search || undefined,
    shareType: shareType || undefined,
    condition: condition || undefined,
    format: format || undefined,
  });
  const { data: allCategories } = useAllCategories();
  const { data: myWants, isLoading: myWantsLoading } = useMyWants();
  const { data: myActiveOwnedBookIds, isLoading: activeOwnedBooksLoading } =
    useMyActiveOwnedBookIds();
  const createWant = useCreateWant();
  const deleteWant = useDeleteWant();
  const currentUser = useCurrentUser();

  const activeWantsByBookId = useMemo(
    () =>
      new Map(
        (myWants ?? [])
          .filter((want) => want.status === "active")
          .map((want) => [want.book_id, want.id])
      ),
    [myWants]
  );
  const wantedBookIds = useMemo(
    () => new Set(activeWantsByBookId.keys()),
    [activeWantsByBookId]
  );
  const activeOwnedBookIds = useMemo(
    () => new Set(myActiveOwnedBookIds ?? []),
    [myActiveOwnedBookIds]
  );
  const ownershipFilteredListings = useMemo(
    () =>
      (listings ?? []).filter(
        (listing) => includeOwnListings || listing.user_id !== currentUser?.id
      ),
    [currentUser?.id, includeOwnListings, listings]
  );
  const browseBookIds = useMemo(
    () =>
      Array.from(
        new Set(ownershipFilteredListings.map((listing) => listing.book_id))
      ),
    [ownershipFilteredListings]
  );
  const {
    data: browseBookCategoryIndex,
    isLoading: browseBookCategoryIndexLoading,
  } = useBrowseBookCategoryIndex(browseBookIds);
  const categoryOptionRows = useMemo(() => {
    const categories = allCategories ?? [];
    const childrenByParent = new Map<string, typeof categories>();
    for (const category of categories) {
      if (!category.parent_id) continue;
      const siblings = childrenByParent.get(category.parent_id) ?? [];
      siblings.push(category);
      childrenByParent.set(category.parent_id, siblings);
    }

    const parents = categories
      .filter((category) => !category.parent_id)
      .sort((a, b) => a.name.localeCompare(b.name));

    return parents.flatMap((parent) => {
      const children = (childrenByParent.get(parent.id) ?? [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((child) => ({
          id: child.id,
          name: child.name,
          level: 2 as const,
        }));
      return [{ id: parent.id, name: parent.name, level: 1 as const }, ...children];
    });
  }, [allCategories]);
  const selectedCategoryIds = useMemo(() => {
    if (!categoryId) return null;

    const categories = allCategories ?? [];
    const selected = categories.find((category) => category.id === categoryId);
    if (!selected) return new Set<string>([categoryId]);

    const scope = new Set<string>([selected.id]);
    if (!selected.parent_id) {
      for (const category of categories) {
        if (category.parent_id === selected.id) {
          scope.add(category.id);
        }
      }
    }

    return scope;
  }, [allCategories, categoryId]);
  const filteredListings = useMemo(() => {
    if (!selectedCategoryIds) return ownershipFilteredListings;
    const categoryIndex = browseBookCategoryIndex ?? new Map<string, Set<string>>();

    return ownershipFilteredListings.filter((listing) => {
      const categoryIdsForBook = categoryIndex.get(listing.book_id);
      if (!categoryIdsForBook) return false;

      for (const selectedId of selectedCategoryIds) {
        if (categoryIdsForBook.has(selectedId)) return true;
      }
      return false;
    });
  }, [browseBookCategoryIndex, ownershipFilteredListings, selectedCategoryIds]);
  const isLoadingListings = isLoading || (Boolean(categoryId) && browseBookCategoryIndexLoading);
  const totalPages = Math.max(1, Math.ceil(filteredListings.length / pageSize));
  const pagedListings = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredListings.slice(start, start + pageSize);
  }, [filteredListings, page]);

  useEffect(() => {
    setPage(1);
  }, [search, shareType, condition, format, categoryId, includeOwnListings]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const alreadyInMyWants = selectedListing
    ? wantedBookIds.has(selectedListing.book_id)
    : false;
  const selectedActiveWantId = selectedListing
    ? activeWantsByBookId.get(selectedListing.book_id) ?? null
    : null;
  const alreadyInMyLibrary = selectedListing
    ? activeOwnedBookIds.has(selectedListing.book_id)
    : false;

  function handleListingSelect(listing: PgBrowseListing) {
    setSelectedListing(listing);
    setAddWantError(null);
    setDialogOpen(true);
  }

  function handleAddToWants() {
    if (
      !selectedListing ||
      alreadyInMyWants ||
      alreadyInMyLibrary ||
      myWantsLoading ||
      activeOwnedBooksLoading
    ) {
      return;
    }

    setAddWantError(null);
    createWant.mutate(
      {
        bookId: selectedListing.book_id,
        editionId: selectedListing.edition_id,
      },
      {
        onSuccess: () => {
          setAddWantError(null);
          setDialogOpen(false);
        },
        onError: (error) => {
          const message =
            error instanceof Error &&
            error.message.toLowerCase().includes("already have a want")
              ? "This book is already in your wants list."
              : error instanceof Error &&
                error.message.toLowerCase().includes("active copy")
                ? "You already have an active copy of this book in your library."
              : "Could not add this book to your wants list.";
          setAddWantError(message);
        },
      }
    );
  }

  function handleRemoveInterest() {
    if (!selectedActiveWantId) return;

    setAddWantError(null);
    deleteWant.mutate(selectedActiveWantId, {
      onSuccess: () => {
        setAddWantError(null);
        setDialogOpen(false);
      },
      onError: (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Could not remove your interest for this listing.";
        setAddWantError(message);
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Browse Books</h1>
        <p className="text-muted-foreground">
          Discover books available from community members
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title or author..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={shareType || "all"}
          onValueChange={(value) => setShareType(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Share type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="lend">Lend</SelectItem>
            <SelectItem value="sell">Sell</SelectItem>
            <SelectItem value="give_away">Give Away</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={condition || "all"}
          onValueChange={(value) => setCondition(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="like_new">Like New</SelectItem>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="fair">Fair</SelectItem>
            <SelectItem value="poor">Poor</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={format || "all"}
          onValueChange={(value) => setFormat(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            <SelectItem value="hardcover">Hardcover</SelectItem>
            <SelectItem value="paperback">Paperback</SelectItem>
            <SelectItem value="mass_market">Mass Market</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={categoryId || "all"}
          onValueChange={(value) => setCategoryId(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoryOptionRows.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.level === 2 ? `↳ ${category.name}` : category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={includeOwnListings ? "secondary" : "outline"}
          onClick={() => setIncludeOwnListings((prev) => !prev)}
          type="button"
        >
          {includeOwnListings ? "Hide My Listings" : "Show My Listings"}
        </Button>
      </div>

      {isLoadingListings ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[220px] animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      ) : filteredListings.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pagedListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onSelect={handleListingSelect}
              />
            ))}
          </div>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={filteredListings.length}
            onPageChange={setPage}
          />
        </>
      ) : (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">No listings found</p>
        </div>
      )}

      <BookDetailsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bookId={selectedListing?.book_id ?? null}
        fallbackTitle={selectedListing?.book_title}
        fallbackSubtitle={selectedListing?.book_subtitle}
        preferredImageUrl={selectedListing?.cover_image_url}
        footer={
          <div className="w-full space-y-1">
            {alreadyInMyWants ? (
              <Button
                variant="outline"
                onClick={handleRemoveInterest}
                disabled={
                  !selectedListing ||
                  !selectedActiveWantId ||
                  myWantsLoading ||
                  deleteWant.isPending
                }
              >
                {myWantsLoading
                  ? "Checking..."
                  : deleteWant.isPending
                    ? "Removing..."
                    : "Remove Interest"}
              </Button>
            ) : (
              <Button
                onClick={handleAddToWants}
                disabled={
                  !selectedListing ||
                  myWantsLoading ||
                  activeOwnedBooksLoading ||
                  alreadyInMyWants ||
                  alreadyInMyLibrary ||
                  createWant.isPending
                }
              >
                {myWantsLoading || activeOwnedBooksLoading
                  ? "Checking..."
                  : alreadyInMyLibrary
                  ? "Already in My Library"
                  : createWant.isPending
                    ? "Adding..."
                    : "Add to My Wants"}
              </Button>
            )}
            {addWantError && (
              <p className="text-xs text-destructive">{addWantError}</p>
            )}
          </div>
        }
      >
        {selectedListing && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Available listing</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedListing.share_type && (
                <Badge variant="default">
                  {shareTypeLabels[selectedListing.share_type] ??
                    selectedListing.share_type}
                </Badge>
              )}
              <Badge variant="secondary">
                {conditionLabels[selectedListing.condition] ??
                  selectedListing.condition}
              </Badge>
              <Badge variant="outline">
                {formatLabels[selectedListing.format] ?? selectedListing.format}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Listed by @{selectedListing.owner_username ?? "member"}
              {selectedListing.owner_display_name
                ? ` (${selectedListing.owner_display_name})`
                : ""}
            </p>
            {selectedListing.status === "lent" && (
              <p className="text-sm">
                {selectedListing.borrower_username
                  ? `Borrowed by @${selectedListing.borrower_username} from @${selectedListing.owner_username ?? "member"}`
                  : "Borrowed off-platform"}
              </p>
            )}
          </div>
        )}
      </BookDetailsDialog>
    </div>
  );
}
