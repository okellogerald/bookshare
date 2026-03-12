"use client";

import { useQuery } from "@tanstack/react-query";
import type { PgBrowseWish } from "@/shared/api";

interface CommunityWishlistFilters {
  search?: string;
}

async function fetchCommunityWishlist(
  filters: CommunityWishlistFilters
): Promise<PgBrowseWish[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "wish_count.desc,book_title.asc");

  if (filters.search) {
    params.set("book_title", `ilike.*${filters.search}*`);
  }

  const response = await fetch(`/api/postgrest/browse_wishes?${params}`);
  if (!response.ok) throw new Error("Failed to fetch community wishlist");
  const json = await response.json();
  return ((json.data as PgBrowseWish[]) ?? []).map((wish) => ({
    ...wish,
    want_count: wish.wish_count,
    wanters: wish.wishers,
  }));
}

export function useBrowseWants(filters: CommunityWishlistFilters = {}) {
  return useQuery({
    queryKey: ["browse-wishes", filters],
    queryFn: () => fetchCommunityWishlist(filters),
  });
}

async function fetchActiveWishersForBook(bookId: string) {
  const params = new URLSearchParams();
  params.set("book_id", `eq.${bookId}`);
  params.set("select", "edition_id,wishers");

  const response = await fetch(`/api/postgrest/browse_wishes?${params}`);
  if (!response.ok) throw new Error("Failed to fetch active wishers");
  const json = await response.json();
  const wishes = (json.data as PgBrowseWish[]) ?? [];
  const merged = new Map<
    string,
    {
      user_id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      notes: string | null;
      created_at: string;
      last_confirmed_at: string | null;
    }
  >();

  for (const wish of wishes) {
    for (const wisher of wish.wishers) {
      merged.set(wisher.user_id, wisher);
    }
  }

  return [...merged.values()];
}

async function fetchActiveWishersForBookAndEdition(
  bookId: string,
  editionId?: string | null
) {
  const params = new URLSearchParams();
  params.set("book_id", `eq.${bookId}`);
  params.set("select", "edition_id,wishers");

  const response = await fetch(`/api/postgrest/browse_wishes?${params}`);
  if (!response.ok) throw new Error("Failed to fetch active wishers");
  const json = await response.json();
  const wishes = (json.data as PgBrowseWish[]) ?? [];

  const scopedWishes = editionId
    ? wishes.filter(
        (wish) => wish.edition_id === editionId || wish.edition_id === null
      )
    : wishes;

  const merged = new Map<
    string,
    {
      user_id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      notes: string | null;
      created_at: string;
      last_confirmed_at: string | null;
    }
  >();

  for (const wish of scopedWishes) {
    for (const wisher of wish.wishers) {
      merged.set(wisher.user_id, wisher);
    }
  }

  return [...merged.values()];
}

export function useActiveWantersForBook(
  bookId: string | null,
  editionId?: string | null
) {
  return useQuery({
    queryKey: ["active-wishers", bookId, editionId ?? null],
    queryFn: () =>
      editionId
        ? fetchActiveWishersForBookAndEdition(bookId!, editionId)
        : fetchActiveWishersForBook(bookId!),
    enabled: !!bookId,
  });
}

export const useBrowseWishes = useBrowseWants;
export const useActiveWishersForBook = useActiveWantersForBook;
