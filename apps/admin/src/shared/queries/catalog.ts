"use client";

import { useQuery } from "@tanstack/react-query";
import type { PgBookWithAuthorsView } from "@/shared/api";

async function fetchCatalogBooks(query: string): Promise<PgBookWithAuthorsView[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const params = new URLSearchParams();
  params.set("select", "id,title,subtitle,language,authors");
  params.set("order", "title.asc");
  params.set("limit", "20");
  params.set("or", `(title.ilike.*${normalized}*,subtitle.ilike.*${normalized}*)`);

  const response = await fetch(`/api/postgrest/books_with_authors?${params}`);
  if (!response.ok) throw new Error("Failed to search catalog");
  const json = await response.json();
  return (json.data ?? []) as PgBookWithAuthorsView[];
}

export function useCatalogBookSearch(query: string) {
  const normalized = query.trim();

  return useQuery({
    queryKey: ["admin-catalog-book-search", normalized],
    queryFn: () => fetchCatalogBooks(normalized),
    enabled: normalized.length >= 2,
  });
}
