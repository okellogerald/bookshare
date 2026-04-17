"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { BrowseBookDialog } from "@/shared/components/browse-book-dialog";
import { PaginationControls } from "@/shared/components/pagination-controls";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  groupBrowseListingsByEdition,
  type BrowseEditionListing,
  useBrowseBookCategoryIndex,
  useBrowseListings,
} from "@/domains/browse/queries";
import { useCreateWant, useDeleteWant, useMyWants } from "@/domains/wishlist/queries";
import { useAllCategories, useMyActiveOwnedBookIds } from "@/domains/library/queries";
import { useCurrentUser } from "@/shared/providers/user-provider";
import { ListingCard } from "./listing-card";

const pageSize = 24;
type BrowseSortOption =
  | "listed_desc"
  | "title_asc"
  | "title_desc"
  | "copies_desc"
  | "confirmed_desc";

function getListingFreshnessValue(listing: BrowseEditionListing) {
  return listing.last_confirmed_at ?? listing.created_at;
}

export default function BrowsePage() {
  const [search, setSearch] = useState("");
  const [shareType, setShareType] = useState<string>("");
  const [condition, setCondition] = useState<string>("");
  const [format, setFormat] = useState<string>("");
  const [themaCode, setThemaCode] = useState<string>("");
  const [sortBy, setSortBy] = useState<BrowseSortOption>("listed_desc");
  const [includeOwnListings, setIncludeOwnListings] = useState(false);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<BrowseEditionListing | null>(null);
  const [addWantError, setAddWantError] = useState<string | null>(null);
  const currentUser = useCurrentUser();
  const isAuthenticated = !!currentUser;

  const { data: listings, isLoading } = useBrowseListings({
    search: search || undefined,
    shareType: shareType || undefined,
    condition: condition || undefined,
    format: format || undefined,
  });
  const { data: allCategories } = useAllCategories();
  const { data: myWants, isLoading: myWantsLoading } = useMyWants({
    enabled: isAuthenticated,
  });
  const { data: myActiveOwnedBookIds, isLoading: activeOwnedBooksLoading } =
    useMyActiveOwnedBookIds({ enabled: isAuthenticated });
  const createWant = useCreateWant();
  const deleteWant = useDeleteWant();

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
  const groupedListings = useMemo(
    () => groupBrowseListingsByEdition(listings ?? []),
    [listings]
  );
  const ownershipFilteredListings = useMemo(
    () =>
      groupedListings.filter(
        (listing) =>
          includeOwnListings ||
          !currentUser?.id ||
          listing.owner_user_ids.some((userId) => userId !== currentUser.id)
      ),
    [currentUser?.id, groupedListings, includeOwnListings]
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
    return categories
      .map((category) => ({
        themaCode: category.thema_code,
        name: category.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCategories]);
  const selectedThemaCodes = useMemo(() => {
    if (!themaCode) return null;
    return new Set<string>([themaCode]);
  }, [themaCode]);
  const filteredListings = useMemo(() => {
    if (!selectedThemaCodes) return ownershipFilteredListings;
    const categoryIndex = browseBookCategoryIndex ?? new Map<string, Set<string>>();

    return ownershipFilteredListings.filter((listing) => {
      const codesForBook = categoryIndex.get(listing.book_id);
      if (!codesForBook) return false;

      for (const code of selectedThemaCodes) {
        if (codesForBook.has(code)) return true;
      }
      return false;
    });
  }, [browseBookCategoryIndex, ownershipFilteredListings, selectedThemaCodes]);
  const sortedListings = useMemo(() => {
    const items = [...filteredListings];
    items.sort((left, right) => {
      switch (sortBy) {
        case "title_asc":
          return (
            left.book_title.localeCompare(right.book_title, undefined, {
              sensitivity: "base",
            }) || right.created_at.localeCompare(left.created_at)
          );
        case "title_desc":
          return (
            right.book_title.localeCompare(left.book_title, undefined, {
              sensitivity: "base",
            }) || right.created_at.localeCompare(left.created_at)
          );
        case "copies_desc":
          return (
            right.copy_count - left.copy_count ||
            left.book_title.localeCompare(right.book_title, undefined, {
              sensitivity: "base",
            })
          );
        case "confirmed_desc":
          return getListingFreshnessValue(right).localeCompare(
            getListingFreshnessValue(left)
          );
        case "listed_desc":
        default:
          return right.created_at.localeCompare(left.created_at);
      }
    });
    return items;
  }, [filteredListings, sortBy]);
  const isLoadingListings = isLoading || (Boolean(themaCode) && browseBookCategoryIndexLoading);
  const totalPages = Math.max(1, Math.ceil(sortedListings.length / pageSize));
  const pagedListings = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedListings.slice(start, start + pageSize);
  }, [page, sortedListings]);

  useEffect(() => {
    setPage(1);
  }, [search, shareType, condition, format, themaCode, includeOwnListings, sortBy]);

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

  function handleListingSelect(listing: BrowseEditionListing) {
    setSelectedListing(listing);
    setAddWantError(null);
    setDialogOpen(true);
  }

  function handleAddToWants() {
    if (!currentUser) {
      window.location.href = "/api/auth/login?returnTo=/browse";
      return;
    }

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
              ? "This book is already in your wishlist."
              : error instanceof Error &&
                error.message.toLowerCase().includes("active copy")
                ? "You already have an active copy of this book in your library."
              : "Could not add this book to your wishlist.";
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
            <SelectItem value="all">All conditions</SelectItem>
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
            <SelectItem value="all">All formats</SelectItem>
            <SelectItem value="hardcover">Hardcover</SelectItem>
            <SelectItem value="paperback">Paperback</SelectItem>
            <SelectItem value="mass_market">Mass Market</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={themaCode || "all"}
          onValueChange={(value) => setThemaCode(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoryOptionRows.map((category) => (
              <SelectItem key={category.themaCode} value={category.themaCode}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          onValueChange={(value) => setSortBy(value as BrowseSortOption)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="listed_desc">Newest listings</SelectItem>
            <SelectItem value="confirmed_desc">Recently confirmed</SelectItem>
            <SelectItem value="copies_desc">Most copies</SelectItem>
            <SelectItem value="title_asc">Title A-Z</SelectItem>
            <SelectItem value="title_desc">Title Z-A</SelectItem>
          </SelectContent>
        </Select>
        {isAuthenticated ? (
          <Button
            variant={includeOwnListings ? "secondary" : "outline"}
            onClick={() => setIncludeOwnListings((prev) => !prev)}
            type="button"
          >
            {includeOwnListings ? "Hide My Listings" : "Show My Listings"}
          </Button>
        ) : null}
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
      ) : sortedListings.length > 0 ? (
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
            totalItems={sortedListings.length}
            onPageChange={setPage}
          />
        </>
      ) : (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">No listings found</p>
        </div>
      )}

      <BrowseBookDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        listing={selectedListing}
        isAuthenticated={isAuthenticated}
        alreadyInMyWants={alreadyInMyWants}
        alreadyInMyLibrary={alreadyInMyLibrary}
        myWantsLoading={myWantsLoading}
        activeOwnedBooksLoading={activeOwnedBooksLoading}
        createWantPending={createWant.isPending}
        deleteWantPending={deleteWant.isPending}
        addWantError={addWantError}
        onAddToWants={handleAddToWants}
        onRemoveInterest={handleRemoveInterest}
      />
    </div>
  );
}
