"use client";

import { useQuery } from "@tanstack/react-query";
import type { PgBrowseListing } from "@/shared/api";

export interface BrowseEditionListing {
  id: string;
  book_id: string;
  edition_id: string;
  owner_user_ids: string[];
  book_title: string;
  book_subtitle: string | null;
  authors: Array<{ id: string; name: string }>;
  cover_image_url: string | null;
  edition_description: string | null;
  book_language: string;
  isbn: string | null;
  format: string;
  publisher: string | null;
  published_year: number | null;
  page_count: number | null;
  share_types: string[];
  copy_count: number;
  book_edition_count: number;
  last_confirmed_at: string | null;
  created_at: string;
}

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
  params.set("status", "eq.available");

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
  return json.data as PgBrowseListing[];
}

export function groupBrowseListingsByEdition(
  listings: PgBrowseListing[]
): BrowseEditionListing[] {
  const editionCountsByBook = new Map<string, Set<string>>();
  for (const listing of listings) {
    const existing = editionCountsByBook.get(listing.book_id) ?? new Set<string>();
    existing.add(listing.edition_id);
    editionCountsByBook.set(listing.book_id, existing);
  }

  const grouped = new Map<string, BrowseEditionListing>();

  for (const listing of listings) {
    const existing = grouped.get(listing.edition_id);
    const shareTypes = listing.share_type ? [listing.share_type] : [];
    const bookEditionCount =
      editionCountsByBook.get(listing.book_id)?.size ?? 1;

    if (!existing) {
      grouped.set(listing.edition_id, {
        id: listing.edition_id,
        book_id: listing.book_id,
        edition_id: listing.edition_id,
        owner_user_ids: [listing.user_id],
        book_title: listing.book_title,
        book_subtitle: listing.book_subtitle,
        authors: listing.authors,
        cover_image_url: listing.cover_image_url,
        edition_description: listing.edition_description,
        book_language: listing.book_language,
        isbn: listing.isbn,
        format: listing.format,
        publisher: listing.publisher,
        published_year: listing.published_year,
        page_count: listing.page_count,
        share_types: shareTypes,
        copy_count: 1,
        book_edition_count: bookEditionCount,
        last_confirmed_at: listing.last_confirmed_at,
        created_at: listing.created_at,
      });
      continue;
    }

    existing.copy_count += 1;
    existing.book_edition_count = bookEditionCount;
    if (!existing.owner_user_ids.includes(listing.user_id)) {
      existing.owner_user_ids.push(listing.user_id);
    }

    if (listing.share_type && !existing.share_types.includes(listing.share_type)) {
      existing.share_types.push(listing.share_type);
    }

    if (listing.created_at > existing.created_at) {
      existing.created_at = listing.created_at;
      existing.last_confirmed_at = listing.last_confirmed_at;
      existing.cover_image_url = listing.cover_image_url ?? existing.cover_image_url;
    } else if (
      listing.last_confirmed_at &&
      (!existing.last_confirmed_at || listing.last_confirmed_at > existing.last_confirmed_at)
    ) {
      existing.last_confirmed_at = listing.last_confirmed_at;
    }
  }

  return Array.from(grouped.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

export function useBrowseListings(filters: BrowseFilters = {}) {
  return useQuery({
    queryKey: ["browse-listings", filters],
    queryFn: () => fetchBrowseListings(filters),
  });
}

interface BrowseBookCategoriesRow {
  id: string;
  categories: Array<{ thema_code: string }>;
}

async function fetchBrowseBookCategoryIndex(
  bookIds: string[]
): Promise<Map<string, Set<string>>> {
  const uniqueBookIds = Array.from(new Set(bookIds)).sort();
  if (uniqueBookIds.length === 0) return new Map();

  const params = new URLSearchParams();
  params.set("select", "id,categories");
  params.set("id", `in.(${uniqueBookIds.join(",")})`);

  const response = await fetch(`/api/postgrest/books_with_categories?${params}`);
  if (!response.ok) throw new Error("Failed to fetch browse book categories");
  const json = await response.json();
  const rows = (json.data ?? []) as BrowseBookCategoriesRow[];

  const categoryIndex = new Map<string, Set<string>>();
  for (const row of rows) {
    categoryIndex.set(
      row.id,
      new Set((row.categories ?? []).map((category) => category.thema_code))
    );
  }

  return categoryIndex;
}

export function useBrowseBookCategoryIndex(bookIds: string[]) {
  const uniqueBookIds = Array.from(new Set(bookIds)).sort();

  return useQuery({
    queryKey: ["browse-book-category-index", uniqueBookIds],
    queryFn: () => fetchBrowseBookCategoryIndex(uniqueBookIds),
    enabled: uniqueBookIds.length > 0,
  });
}
