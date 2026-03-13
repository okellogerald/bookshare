"use client";

import { useQuery } from "@tanstack/react-query";
import type { PgBrowseWish } from "@/shared/api";

interface CommunityWishlistFilters {
  search?: string;
}

function normalizeBrowseWants(wishes: PgBrowseWish[]): PgBrowseWish[] {
  const mergedByBookId = new Map<string, PgBrowseWish>();

  for (const wish of wishes) {
    const existing = mergedByBookId.get(wish.book_id);

    if (!existing) {
      mergedByBookId.set(wish.book_id, {
        ...wish,
        edition_id: null,
        edition_description: null,
        edition_isbn: null,
        edition_format: null,
        want_count: wish.wish_count,
        wanters: [...wish.wishers],
      });
      continue;
    }

    const wantersByUserId = new Map(
      existing.wanters.map((wanter) => [wanter.user_id, wanter])
    );

    for (const wanter of wish.wishers) {
      const current = wantersByUserId.get(wanter.user_id);
      if (
        !current ||
        (wanter.last_confirmed_at ?? wanter.created_at) >
          (current.last_confirmed_at ?? current.created_at)
      ) {
        wantersByUserId.set(wanter.user_id, wanter);
      }
    }

    existing.wanters = [...wantersByUserId.values()].sort((left, right) =>
      right.created_at.localeCompare(left.created_at)
    );
    existing.wishers = existing.wanters;
    existing.wish_count = existing.wanters.length;
    existing.want_count = existing.wanters.length;

    if (!existing.edition_cover_image_url && wish.edition_cover_image_url) {
      existing.edition_cover_image_url = wish.edition_cover_image_url;
    }
  }

  return [...mergedByBookId.values()].sort(
    (left, right) =>
      right.wish_count - left.wish_count ||
      left.book_title.localeCompare(right.book_title, undefined, {
        sensitivity: "base",
      })
  );
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
  return normalizeBrowseWants((json.data as PgBrowseWish[]) ?? []);
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
  params.set("select", "wishers");

  const response = await fetch(`/api/postgrest/browse_wishes?${params}`);
  if (!response.ok) throw new Error("Failed to fetch active wishers");
  const json = await response.json();
  const wishes = normalizeBrowseWants((json.data as PgBrowseWish[]) ?? []);
  const wishers = wishes[0]?.wishers ?? [];

  const merged = new Map<
    string,
    {
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      location: string | null;
      contact_notes: string | null;
      avatar_url: string | null;
      notes: string | null;
      created_at: string;
      last_confirmed_at: string | null;
    }
  >();

  for (const wisher of wishers) {
    merged.set(wisher.user_id, wisher);
  }

  return [...merged.values()];
}

export function useActiveWantersForBook(bookId: string | null) {
  return useQuery({
    queryKey: ["active-wishers", bookId],
    queryFn: () => fetchActiveWishersForBook(bookId!),
    enabled: !!bookId,
  });
}

export const useBrowseWishes = useBrowseWants;
export const useActiveWishersForBook = useActiveWantersForBook;
