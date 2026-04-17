"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PgBrowseWant } from "@/shared/api";
import { BookDetailsDialog } from "@/shared/components/book-details-dialog";
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
import { useCurrentUser } from "@/shared/providers/user-provider";
import { useMyCopies } from "@/domains/library/queries";
import { useBrowseWants } from "@/domains/community/queries";
import { WishCard } from "./wish-card";

const pageSize = 24;
type CommunitySortOption =
  | "demand_desc"
  | "activity_desc"
  | "title_asc"
  | "title_desc";

function getWantKey(want: PgBrowseWant) {
  return want.book_id;
}

function getWantLatestActivity(want: PgBrowseWant) {
  return want.wanters.reduce((latest, wanter) => {
    const nextValue = wanter.last_confirmed_at ?? wanter.created_at;
    return nextValue > latest ? nextValue : latest;
  }, "");
}

function getMemberName(member: {
  first_name: string | null;
  last_name: string | null;
}) {
  const fullName = [member.first_name, member.last_name]
    .filter((value): value is string => !!value && value.trim().length > 0)
    .join(" ")
    .trim();
  return fullName || "Member";
}

function getMemberChipName(member: {
  first_name: string | null;
  last_name: string | null;
}) {
  const firstName = member.first_name?.trim() ?? "";
  const lastName = member.last_name?.trim() ?? "";

  if (firstName && lastName) {
    return `${firstName} ${lastName[0]}.`;
  }

  if (firstName) {
    return firstName;
  }

  if (lastName) {
    return lastName;
  }

  return "Member";
}

function getInitials(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return (words[0] ?? "M").slice(0, 2).toUpperCase();
}

export default function CommunityWishlistPage() {
  const currentUser = useCurrentUser();
  const isAuthenticated = !!currentUser;
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<CommunitySortOption>("demand_desc");
  const [includeMyWants, setIncludeMyWants] = useState(false);
  const [showFulfillableOnly, setShowFulfillableOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedWantKey, setSelectedWantKey] = useState<string | null>(null);

  const { data: wants, isLoading } = useBrowseWants({ search });
  const { data: myCopies } = useMyCopies({ enabled: isAuthenticated });

  const availableCopies = useMemo(
    () => (myCopies ?? []).filter((copy) => copy.status === "available"),
    [myCopies]
  );

  const matchingCopiesByWantKey = useMemo(() => {
    const map = new Map<string, typeof availableCopies>();
    for (const want of wants ?? []) {
      const matching = availableCopies.filter(
        (copy) => copy.edition?.book?.id === want.book_id
      );
      map.set(getWantKey(want), matching);
    }
    return map;
  }, [availableCopies, wants]);

  const filteredWants = useMemo(() => {
    if (!wants) return [];
    return wants.filter((want) => {
      const hasSelfAsWanter =
        !!currentUser?.id &&
        want.wanters.some((wanter) => wanter.user_id === currentUser.id);
      if (!includeMyWants && hasSelfAsWanter) return false;

      if (!showFulfillableOnly) return true;
      const hasEligibleWanter = want.wanters.some(
        (wanter) => wanter.user_id !== currentUser?.id
      );
      const matchingCopies = matchingCopiesByWantKey.get(getWantKey(want)) ?? [];
      return hasEligibleWanter && matchingCopies.length > 0;
    });
  }, [
    currentUser?.id,
    includeMyWants,
    matchingCopiesByWantKey,
    showFulfillableOnly,
    wants,
  ]);

  const sortedWants = useMemo(() => {
    const items = [...filteredWants];
    items.sort((left, right) => {
      switch (sortBy) {
        case "activity_desc":
          return (
            getWantLatestActivity(right).localeCompare(getWantLatestActivity(left)) ||
            right.want_count - left.want_count
          );
        case "title_asc":
          return (
            left.book_title.localeCompare(right.book_title, undefined, {
              sensitivity: "base",
            }) || right.want_count - left.want_count
          );
        case "title_desc":
          return (
            right.book_title.localeCompare(left.book_title, undefined, {
              sensitivity: "base",
            }) || right.want_count - left.want_count
          );
        case "demand_desc":
        default:
          return (
            right.want_count - left.want_count ||
            left.book_title.localeCompare(right.book_title, undefined, {
              sensitivity: "base",
            })
          );
      }
    });
    return items;
  }, [filteredWants, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedWants.length / pageSize));
  const pagedWants = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedWants.slice(start, start + pageSize);
  }, [page, sortedWants]);

  useEffect(() => {
    setPage(1);
  }, [search, includeMyWants, showFulfillableOnly, sortBy]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const selectedWantFromFiltered = selectedWantKey
    ? filteredWants.find((want) => getWantKey(want) === selectedWantKey) ?? null
    : null;

  useEffect(() => {
    if (detailsOpen && selectedWantKey && !selectedWantFromFiltered) {
      setDetailsOpen(false);
      setSelectedWantKey(null);
    }
  }, [detailsOpen, selectedWantKey, selectedWantFromFiltered]);

  function handleWantSelect(want: PgBrowseWant) {
    setSelectedWantKey(getWantKey(want));
    setDetailsOpen(true);
  }

  function canFulfill(want: PgBrowseWant) {
    if (!isAuthenticated) return false;
    const hasEligibleWanter = want.wanters.some(
      (wanter) => wanter.user_id !== currentUser?.id
    );
    const matchingCopies = matchingCopiesByWantKey.get(getWantKey(want)) ?? [];
    return hasEligibleWanter && matchingCopies.length > 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Requests</h1>
        <p className="text-muted-foreground">
          Books that community members are looking for
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by book title..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        <Select
          value={sortBy}
          onValueChange={(value) => setSortBy(value as CommunitySortOption)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="demand_desc">Most wanted</SelectItem>
            <SelectItem value="activity_desc">Latest activity</SelectItem>
            <SelectItem value="title_asc">Title A-Z</SelectItem>
            <SelectItem value="title_desc">Title Z-A</SelectItem>
          </SelectContent>
        </Select>
        {isAuthenticated ? (
          <>
            <Button
              type="button"
              variant={includeMyWants ? "default" : "outline"}
              onClick={() => setIncludeMyWants((current) => !current)}
            >
              {includeMyWants ? "Hide My Wishlist" : "Show My Wishlist"}
            </Button>
            <Button
              type="button"
              variant={showFulfillableOnly ? "default" : "outline"}
              onClick={() => setShowFulfillableOnly((current) => !current)}
            >
              {showFulfillableOnly
                ? "Show All Wishes"
                : "Show Wishes I Can Fulfill"}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" asChild>
            <Link href="/api/auth/login?returnTo=/community-wishlist">
              Sign In to Compare With My Library
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !sortedWants.length ? (
        <p className="text-muted-foreground">No wishlist matches found.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pagedWants.map((want) => (
              <WishCard
                key={getWantKey(want)}
                want={want}
                canFulfill={canFulfill(want)}
                onSelect={handleWantSelect}
              />
            ))}
          </div>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={sortedWants.length}
            onPageChange={setPage}
          />
        </>
      )}

      <BookDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        bookId={selectedWantFromFiltered?.book_id ?? null}
        compactCatalog
        fallbackTitle={selectedWantFromFiltered?.book_title}
        fallbackSubtitle={selectedWantFromFiltered?.book_subtitle}
        preferredImageUrl={selectedWantFromFiltered?.edition_cover_image_url}
        footer={
          selectedWantFromFiltered ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={`/books/${selectedWantFromFiltered.book_id}`}>
                View Book Details
              </Link>
            </Button>
          ) : undefined
        }
      >
        {selectedWantFromFiltered && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Community wanters ({selectedWantFromFiltered.want_count})
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedWantFromFiltered.wanters.map((wanter) => {
                const fullName = getMemberName(wanter);
                const chipName = getMemberChipName(wanter);
                return (
                  <div
                    key={wanter.user_id}
                    className="inline-flex items-center gap-2 rounded-full border bg-muted/30 py-1 pl-1 pr-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border bg-background text-[10px] font-semibold text-muted-foreground">
                      {wanter.avatar_url ? (
                        <img
                          src={wanter.avatar_url}
                          alt={fullName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{getInitials(fullName)}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{chipName}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </BookDetailsDialog>
    </div>
  );
}
