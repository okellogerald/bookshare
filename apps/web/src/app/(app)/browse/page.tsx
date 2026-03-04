"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useBrowseListings } from "@/shared/queries/browse";
import { useQuotesByBooks } from "@/shared/queries/quotes";
import type { PgBrowseListing } from "@/shared/api";
import { ListingCard } from "./listing-card";
import { BookDetailDialog } from "./book-detail-dialog";

export default function BrowsePage() {
  const [search, setSearch] = useState("");
  const [shareType, setShareType] = useState<string>("");
  const [condition, setCondition] = useState<string>("");
  const [format, setFormat] = useState<string>("");

  const { data: listings, isLoading } = useBrowseListings({
    search: search || undefined,
    shareType: shareType || undefined,
    condition: condition || undefined,
    format: format || undefined,
  });

  // Collect unique book IDs from listings
  const bookIds = useMemo(
    () => [...new Set(listings?.map((l) => l.book_id) ?? [])],
    [listings]
  );

  const { data: allQuotes } = useQuotesByBooks(bookIds);

  // Build a map of bookId → random quote text
  const quoteMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!allQuotes) return map;

    const byBook = new Map<string, string[]>();
    for (const q of allQuotes) {
      const arr = byBook.get(q.book_id) ?? [];
      arr.push(q.text);
      byBook.set(q.book_id, arr);
    }
    for (const [bookId, texts] of byBook) {
      map.set(bookId, texts[Math.floor(Math.random() * texts.length)]);
    }
    return map;
  }, [allQuotes]);

  // Dialog state
  const [selectedListing, setSelectedListing] =
    useState<PgBrowseListing | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Browse Books</h1>
        <p className="text-muted-foreground">
          Discover books available from community members
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title or author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

      {/* Listings Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
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
              quote={quoteMap.get(listing.book_id)}
              onClick={() => setSelectedListing(listing)}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">No listings found</p>
        </div>
      )}

      {/* Book Detail Dialog */}
      {selectedListing && (
        <BookDetailDialog
          bookId={selectedListing.book_id}
          editionId={selectedListing.edition_id}
          bookTitle={selectedListing.book_title}
          bookSubtitle={selectedListing.book_subtitle}
          authors={selectedListing.authors.map((a) => a.name).join(", ")}
          open={!!selectedListing}
          onOpenChange={(open) => {
            if (!open) setSelectedListing(null);
          }}
        />
      )}
    </div>
  );
}
