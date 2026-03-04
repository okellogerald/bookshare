"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  PgBookQuoteWithBook,
  CreateQuoteBody,
  UpdateQuoteBody,
  QuoteResponse,
} from "@/shared/api";
import { nestjsFetch } from "./fetch";

// ─── Queries ────────────────────────────────────────────────

async function fetchQuotesByBook(
  bookId: string
): Promise<PgBookQuoteWithBook[]> {
  const params = new URLSearchParams();
  params.set("book_id", `eq.${bookId}`);
  params.set("order", "created_at.desc");

  const response = await fetch(
    `/api/postgrest/book_quotes_with_book?${params}`
  );
  if (!response.ok) throw new Error("Failed to fetch quotes");
  const json = await response.json();
  return json.data;
}

async function fetchQuotesByBooks(
  bookIds: string[]
): Promise<PgBookQuoteWithBook[]> {
  if (bookIds.length === 0) return [];
  const params = new URLSearchParams();
  params.set("book_id", `in.(${bookIds.join(",")})`);
  params.set("order", "created_at.desc");

  const response = await fetch(
    `/api/postgrest/book_quotes_with_book?${params}`
  );
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

// ─── Mutations ──────────────────────────────────────────────

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
