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
  params.set("order", "created_at.desc");

  if (filters.search) {
    params.set("book_title", `ilike.*${filters.search}*`);
  }

  const response = await fetch(`/api/postgrest/browse_wants?${params}`);
  if (!response.ok) throw new Error("Failed to fetch wanted books");
  const json = await response.json();
  return json.data;
}

export function useBrowseWants(filters: WantedFilters = {}) {
  return useQuery({
    queryKey: ["browse-wants", filters],
    queryFn: () => fetchBrowseWants(filters),
  });
}
