"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PgBrowseListing } from "@/shared/api";
import { BookDetailsDialog } from "@/shared/components/book-details-dialog";
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
import { useBrowseListings } from "@/shared/queries/browse";
import { useCreateWant, useMyWants } from "@/shared/queries/my-wants";
import { useMyActiveOwnedBookIds } from "@/shared/queries/my-library";
import { ListingCard } from "./listing-card";

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

export default function BrowsePage() {
  const [search, setSearch] = useState("");
  const [shareType, setShareType] = useState<string>("");
  const [condition, setCondition] = useState<string>("");
  const [format, setFormat] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<PgBrowseListing | null>(null);
  const [addWantError, setAddWantError] = useState<string | null>(null);

  const { data: listings, isLoading } = useBrowseListings({
    search: search || undefined,
    shareType: shareType || undefined,
    condition: condition || undefined,
    format: format || undefined,
  });
  const { data: myWants, isLoading: myWantsLoading } = useMyWants();
  const { data: myActiveOwnedBookIds, isLoading: activeOwnedBooksLoading } =
    useMyActiveOwnedBookIds();
  const createWant = useCreateWant();

  const wantedBookIds = useMemo(
    () => new Set(myWants?.map((want) => want.book_id) ?? []),
    [myWants]
  );
  const activeOwnedBookIds = useMemo(
    () => new Set(myActiveOwnedBookIds ?? []),
    [myActiveOwnedBookIds]
  );

  const alreadyInMyWants = selectedListing
    ? wantedBookIds.has(selectedListing.book_id)
    : false;
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
      { bookId: selectedListing.book_id },
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

        <Select value={shareType} onValueChange={setShareType}>
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

        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="like_new">Like New</SelectItem>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="fair">Fair</SelectItem>
            <SelectItem value="poor">Poor</SelectItem>
          </SelectContent>
        </Select>

        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="hardcover">Hardcover</SelectItem>
            <SelectItem value="paperback">Paperback</SelectItem>
            <SelectItem value="mass_market">Mass Market</SelectItem>
            <SelectItem value="ebook">eBook</SelectItem>
            <SelectItem value="audiobook">Audiobook</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[220px] animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      ) : listings && listings.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onSelect={handleListingSelect}
            />
          ))}
        </div>
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
        footer={
          <div className="w-full space-y-1">
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
                : alreadyInMyWants
                ? "Already in My Wants"
                : alreadyInMyLibrary
                ? "Already in My Library"
                : createWant.isPending
                  ? "Adding..."
                  : "Add to My Wants"}
            </Button>
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
              <Badge variant="outline">{selectedListing.format}</Badge>
            </div>
            {selectedListing.location && (
              <p className="text-sm text-muted-foreground">
                Location: {selectedListing.location}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Listed by @{selectedListing.owner_username ?? "member"}
              {selectedListing.owner_display_name
                ? ` (${selectedListing.owner_display_name})`
                : ""}
            </p>
            {selectedListing.status === "lent" && (
              <p className="text-sm">
                Borrowed by @{selectedListing.borrower_username ?? "member"} from @
                {selectedListing.owner_username ?? "member"}
              </p>
            )}
            {selectedListing.contact_note && (
              <p className="text-sm">{selectedListing.contact_note}</p>
            )}
          </div>
        )}
      </BookDetailsDialog>
    </div>
  );
}
