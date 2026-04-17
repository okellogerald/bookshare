"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  PgBookWithAuthorsView,
  PgBookWithCategoriesView,
  PgEdition,
  PgBrowseListing,
  PgBookQuoteWithBook,
} from "@/shared/api";
import { normalizeLocalMinioUrls } from "@/shared/lib/minio-url";
import { nestjsFetch } from "@/shared/lib/fetch";
import type {
  CreateQuoteBody,
  UpdateQuoteBody,
  QuoteResponse,
} from "./contracts";

// ─── Book detail ─────────────────────────────────────────────

async function fetchBookDetail(bookId: string): Promise<PgBookWithAuthorsView | null> {
  const params = new URLSearchParams();
  params.set("id", `eq.${bookId}`);
  const response = await fetch(`/api/backend/books_with_authors?${params}`);
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

async function fetchBookCategories(bookId: string): Promise<PgBookWithCategoriesView | null> {
  const params = new URLSearchParams();
  params.set("id", `eq.${bookId}`);
  const response = await fetch(`/api/backend/books_with_categories?${params}`);
  if (!response.ok) throw new Error("Failed to fetch book categories");
  const json = await response.json();
  return json.data?.[0] ?? null;
}

export function useBookCategories(bookId: string) {
  return useQuery({
    queryKey: ["book-categories", bookId],
    queryFn: () => fetchBookCategories(bookId),
    enabled: !!bookId,
  });
}

// ─── Editions ────────────────────────────────────────────────

async function fetchEditionsByBook(bookId: string): Promise<PgEdition[]> {
  const params = new URLSearchParams();
  params.set("book_id", `eq.${bookId}`);
  params.set("order", "created_at.desc");
  const response = await fetch(`/api/backend/editions?${params}`);
  if (!response.ok) throw new Error("Failed to fetch editions");
  const json = await response.json();
  return normalizeLocalMinioUrls(json.data as PgEdition[]);
}

export function useEditionsByBook(bookId: string) {
  return useQuery({
    queryKey: ["editions-by-book", bookId],
    queryFn: () => fetchEditionsByBook(bookId),
    enabled: !!bookId,
  });
}

// ─── Listings for a book ─────────────────────────────────────

async function fetchListingsByBook(bookId: string): Promise<PgBrowseListing[]> {
  const params = new URLSearchParams();
  params.set("book_id", `eq.${bookId}`);
  params.set("status", "eq.available");
  params.set("order", "created_at.desc");
  const response = await fetch(`/api/backend/browse_listings?${params}`);
  if (!response.ok) throw new Error("Failed to fetch listings");
  const json = await response.json();
  return normalizeLocalMinioUrls(json.data as PgBrowseListing[]);
}

export function useListingsByBook(bookId: string) {
  return useQuery({
    queryKey: ["listings-by-book", bookId],
    queryFn: () => fetchListingsByBook(bookId),
    enabled: !!bookId,
  });
}

// ─── Book with authors ───────────────────────────────────────

async function fetchBookWithAuthors(bookId: string): Promise<PgBookWithAuthorsView | null> {
  const params = new URLSearchParams();
  params.set("id", `eq.${bookId}`);
  const response = await fetch(`/api/backend/books_with_authors?${params}`);
  if (!response.ok) throw new Error("Failed to fetch book with authors");
  const json = await response.json();
  return json.data?.[0] ?? null;
}

export function useBookWithAuthors(bookId: string | undefined) {
  return useQuery({
    queryKey: ["book-with-authors", bookId],
    queryFn: () => fetchBookWithAuthors(bookId!),
    enabled: !!bookId,
  });
}

// ─── Quotes ──────────────────────────────────────────────────

async function fetchQuotesByBook(bookId: string): Promise<PgBookQuoteWithBook[]> {
  const params = new URLSearchParams();
  params.set("book_id", `eq.${bookId}`);
  params.set("order", "created_at.desc");
  const response = await fetch(`/api/backend/book_quotes_with_book?${params}`);
  if (!response.ok) throw new Error("Failed to fetch quotes");
  const json = await response.json();
  return json.data;
}

async function fetchQuotesByBooks(bookIds: string[]): Promise<PgBookQuoteWithBook[]> {
  if (bookIds.length === 0) return [];
  const params = new URLSearchParams();
  params.set("book_id", `in.(${bookIds.join(",")})`);
  params.set("order", "created_at.desc");
  const response = await fetch(`/api/backend/book_quotes_with_book?${params}`);
  if (!response.ok) throw new Error("Failed to fetch quotes");
  const json = await response.json();
  return json.data;
}

export function useQuotesByBook(bookId: string | undefined) {
  return useQuery({
    queryKey: ["quotes", "by-book", bookId],
    queryFn: () => fetchQuotesByBook(bookId!),
    enabled: !!bookId,
  });
}

export function useQuotesByBooks(bookIds: string[]) {
  return useQuery({
    queryKey: ["quotes", "by-books", bookIds],
    queryFn: () => fetchQuotesByBooks(bookIds),
    enabled: bookIds.length > 0,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateQuoteBody) =>
      nestjsFetch<QuoteResponse>("quotes", "POST", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateQuoteBody }) =>
      nestjsFetch<QuoteResponse>(`quotes/${id}`, "PUT", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      nestjsFetch<{ deleted: boolean }>(`quotes/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}
