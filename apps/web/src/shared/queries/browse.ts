"use client";

import { useQuery } from "@tanstack/react-query";
import type { PgBrowseListing } from "@/shared/api";
import { isHiddenCommunityUsername } from "@/shared/lib/member-visibility";

interface BrowseFilters {
  search?: string;
  shareType?: string;
  condition?: string;
  format?: string;
}

async function fetchBrowseListings(
  filters: BrowseFilters
): Promise<PgBrowseListing[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "created_at.desc");

  if (filters.search) {
    params.set("book_title", `ilike.*${filters.search}*`);
  }
  if (filters.shareType && filters.shareType !== "all") {
    params.set("share_type", `eq.${filters.shareType}`);
  }
  if (filters.condition && filters.condition !== "all") {
    params.set("condition", `eq.${filters.condition}`);
  }
  if (filters.format && filters.format !== "all") {
    params.set("format", `eq.${filters.format}`);
  }

  const response = await fetch(`/api/postgrest/browse_listings?${params}`);
  if (!response.ok) throw new Error("Failed to fetch listings");
  const json = await response.json();
  const listings = json.data as PgBrowseListing[];
  return listings
    .filter((listing) => !isHiddenCommunityUsername(listing.owner_username))
    .map((listing) => {
      if (!isHiddenCommunityUsername(listing.borrower_username)) return listing;
      return {
        ...listing,
        borrower_username: null,
        borrower_display_name: null,
      };
    });
}

export function useBrowseListings(filters: BrowseFilters = {}) {
  return useQuery({
    queryKey: ["browse-listings", filters],
    queryFn: () => fetchBrowseListings(filters),
  });
}
