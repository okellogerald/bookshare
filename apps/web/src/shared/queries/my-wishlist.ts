"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PgFulfilledWishHistory, PgWishWithBook } from "@/shared/api";
import type {
  CreateWishBody,
  UpdateWishBody,
  WishResponse,
  WishSearchResult,
} from "@/shared/api";
import { nestjsFetch } from "./fetch";

// ─── Queries ────────────────────────────────────────────────

async function fetchMyWishlist(): Promise<PgWishWithBook[]> {
  const params = new URLSearchParams();
  params.set("select", "*,book:books(*)");
  params.set("status", "in.(active,fulfilled)");
  params.set("order", "created_at.desc");

  const response = await fetch(`/api/postgrest/wishes?${params}`);
  if (!response.ok) throw new Error("Failed to fetch wishlist");
  const json = await response.json();
  return json.data;
}

export function useMyWants(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["my-wishlist"],
    queryFn: fetchMyWishlist,
    enabled: options?.enabled ?? true,
  });
}

async function fetchWishSearchResults(query: string): Promise<WishSearchResult[]> {
  const response = await fetch(
    `/api/nestjs/wishes/search?q=${encodeURIComponent(query.trim())}`
  );
  if (!response.ok) throw new Error("Failed to search books for wishes");
  return response.json();
}

export function useWantSearchResults(query: string) {
  const normalized = query.trim();
  return useQuery({
    queryKey: ["wish-search-results", normalized],
    queryFn: () => fetchWishSearchResults(normalized),
    enabled: normalized.length >= 2,
  });
}

async function fetchFulfilledWishesHistory(): Promise<PgFulfilledWishHistory[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "fulfilled_at.desc");

  const response = await fetch(`/api/postgrest/fulfilled_wishes_history?${params}`);
  if (!response.ok) throw new Error("Failed to fetch fulfilled wishlist history");
  const json = await response.json();
  return ((json.data as PgFulfilledWishHistory[]) ?? []).map((entry) => ({
    ...entry,
    want_id: entry.wish_id,
    wanted_edition_id: entry.wished_edition_id,
    wanted_edition_isbn: entry.wished_edition_isbn,
    wanted_edition_format: entry.wished_edition_format,
    wanted_edition_cover_image_url: entry.wished_edition_cover_image_url,
    wanter_notes: entry.wisher_notes,
  }));
}

export function useFulfilledWantsHistory() {
  return useQuery({
    queryKey: ["fulfilled-wishes-history"],
    queryFn: fetchFulfilledWishesHistory,
  });
}

// ─── Mutations ──────────────────────────────────────────────

export function useCreateWant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWishBody) =>
      nestjsFetch<WishResponse>("wishes", "POST", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["browse-wishes"] });
      queryClient.invalidateQueries({ queryKey: ["active-wishers"] });
    },
  });
}

export function useConfirmWant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      nestjsFetch<WishResponse>(`wishes/${id}/confirm`, "PATCH"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["browse-wishes"] });
      queryClient.invalidateQueries({ queryKey: ["active-wishers"] });
    },
  });
}

export function useUpdateWant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateWishBody }) =>
      nestjsFetch<WishResponse>(`wishes/${id}`, "PATCH", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["browse-wishes"] });
      queryClient.invalidateQueries({ queryKey: ["active-wishers"] });
      queryClient.invalidateQueries({ queryKey: ["wish"] });
    },
  });
}

export function useDeleteWant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      nestjsFetch<{ deleted: boolean }>(`wishes/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["browse-wishes"] });
      queryClient.invalidateQueries({ queryKey: ["active-wishers"] });
      queryClient.invalidateQueries({ queryKey: ["wish"] });
    },
  });
}

export const useMyWishlist = useMyWants;
export const useWishSearchResults = useWantSearchResults;
export const useFulfilledWishesHistory = useFulfilledWantsHistory;
export const useCreateWish = useCreateWant;
export const useConfirmWish = useConfirmWant;
export const useUpdateWish = useUpdateWant;
export const useDeleteWish = useDeleteWant;
