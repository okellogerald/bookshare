"use client";

import { useQuery } from "@tanstack/react-query";
import type { PgBrowseWant } from "@/shared/api";

interface WantedFilters {
  search?: string;
}

async function fetchBrowseWants(
  filters: WantedFilters
): Promise<PgBrowseWant[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "want_count.desc,book_title.asc");

  if (filters.search) {
    params.set("book_title", `ilike.*${filters.search}*`);
  }

  const response = await fetch(`/api/postgrest/browse_wants?${params}`);
  if (!response.ok) throw new Error("Failed to fetch wanted books");
  const json = await response.json();
  return json.data as PgBrowseWant[];
}

export function useBrowseWants(filters: WantedFilters = {}) {
  return useQuery({
    queryKey: ["browse-wants", filters],
    queryFn: () => fetchBrowseWants(filters),
  });
}

async function fetchActiveWantersForBook(bookId: string) {
  const params = new URLSearchParams();
  params.set("book_id", `eq.${bookId}`);
  params.set("select", "edition_id,wanters");

  const response = await fetch(`/api/postgrest/browse_wants?${params}`);
  if (!response.ok) throw new Error("Failed to fetch active wanters");
  const json = await response.json();
  const wants = (json.data as PgBrowseWant[]) ?? [];
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

  for (const want of wants) {
    for (const wanter of want.wanters) {
      merged.set(wanter.user_id, wanter);
    }
  }

  return [...merged.values()];
}

async function fetchActiveWantersForBookAndEdition(
  bookId: string,
  editionId?: string | null
) {
  const params = new URLSearchParams();
  params.set("book_id", `eq.${bookId}`);
  params.set("select", "edition_id,wanters");

  const response = await fetch(`/api/postgrest/browse_wants?${params}`);
  if (!response.ok) throw new Error("Failed to fetch active wanters");
  const json = await response.json();
  const wants = (json.data as PgBrowseWant[]) ?? [];

  const scopedWants = editionId
    ? wants.filter(
        (want) => want.edition_id === editionId || want.edition_id === null
      )
    : wants;

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

  for (const want of scopedWants) {
    for (const wanter of want.wanters) {
      merged.set(wanter.user_id, wanter);
    }
  }

  return [...merged.values()];
}

export function useActiveWantersForBook(
  bookId: string | null,
  editionId?: string | null
) {
  return useQuery({
    queryKey: ["active-wanters", bookId, editionId ?? null],
    queryFn: () =>
      editionId
        ? fetchActiveWantersForBookAndEdition(bookId!, editionId)
        : fetchActiveWantersForBook(bookId!),
    enabled: !!bookId,
  });
}
