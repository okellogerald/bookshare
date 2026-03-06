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
  params.set("select", "*");
  params.set("limit", "1");

  const response = await fetch(`/api/postgrest/browse_wants?${params}`);
  if (!response.ok) throw new Error("Failed to fetch active wanters");
  const json = await response.json();
  const wants = (json.data as PgBrowseWant[]) ?? [];
  return wants[0]?.wanters ?? [];
}

export function useActiveWantersForBook(bookId: string | null) {
  return useQuery({
    queryKey: ["active-wanters", bookId],
    queryFn: () => fetchActiveWantersForBook(bookId!),
    enabled: !!bookId,
  });
}
