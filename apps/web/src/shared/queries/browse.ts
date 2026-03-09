"use client";

import { useQuery } from "@tanstack/react-query";
import type { PgBrowseListing } from "@/shared/api";

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
  return json.data as PgBrowseListing[];
}

export function useBrowseListings(filters: BrowseFilters = {}) {
  return useQuery({
    queryKey: ["browse-listings", filters],
    queryFn: () => fetchBrowseListings(filters),
  });
}

interface BrowseBookCategoriesRow {
  id: string;
  categories: Array<{ id: string }>;
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
      new Set((row.categories ?? []).map((category) => category.id))
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
