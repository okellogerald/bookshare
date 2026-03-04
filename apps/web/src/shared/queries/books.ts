"use client";

import { useQuery } from "@tanstack/react-query";
import type { PgBookWithAuthorsView, PgEdition, PgBrowseListing } from "@/shared/api";

// ─── Book detail (with authors) ─────────────────────────────

async function fetchBookDetail(
  bookId: string
): Promise<PgBookWithAuthorsView | null> {
  const params = new URLSearchParams();
  params.set("id", `eq.${bookId}`);

  const response = await fetch(`/api/postgrest/books_with_authors?${params}`);
  if (!response.ok) throw new Error("Failed to fetch book");
  const json = await response.json();
  return json.data?.[0] ?? null;
}

export function useBookDetail(bookId: string) {
  return useQuery({
    queryKey: ["book-detail", bookId],
    queryFn: () => fetchBookDetail(bookId),
    enabled: !!bookId,
  });
}

// ─── Editions for a book ────────────────────────────────────

async function fetchEditionsByBook(bookId: string): Promise<PgEdition[]> {
  const params = new URLSearchParams();
  params.set("book_id", `eq.${bookId}`);
  params.set("order", "created_at.desc");

  const response = await fetch(`/api/postgrest/editions?${params}`);
  if (!response.ok) throw new Error("Failed to fetch editions");
  const json = await response.json();
  return json.data;
}

export function useEditionsByBook(bookId: string) {
  return useQuery({
    queryKey: ["editions-by-book", bookId],
    queryFn: () => fetchEditionsByBook(bookId),
    enabled: !!bookId,
  });
}

// ─── Available copies (listings) for a book ─────────────────

async function fetchListingsByBook(
  bookId: string
): Promise<PgBrowseListing[]> {
  const params = new URLSearchParams();
  params.set("book_id", `eq.${bookId}`);
  params.set("order", "created_at.desc");

  const response = await fetch(`/api/postgrest/browse_listings?${params}`);
  if (!response.ok) throw new Error("Failed to fetch listings");
  const json = await response.json();
  return json.data;
}

export function useListingsByBook(bookId: string) {
  return useQuery({
    queryKey: ["listings-by-book", bookId],
    queryFn: () => fetchListingsByBook(bookId),
    enabled: !!bookId,
  });
}
