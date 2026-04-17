"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PgWishWithBook } from "@/shared/api";
import { normalizeLocalMinioUrls } from "@/shared/lib/minio-url";
import { nestjsFetch } from "@/shared/lib/fetch";
import type {
  CreateWishBody,
  UpdateWishBody,
  WishResponse,
  WishSearchResult,
} from "./contracts";

// ─── Queries ─────────────────────────────────────────────────

async function fetchMyWishlist(): Promise<PgWishWithBook[]> {
  const params = new URLSearchParams();
  params.set("select", "*,book:books(*)");
  params.set("status", "eq.active");
  params.set("order", "created_at.desc");
  const response = await fetch(`/api/backend/wishes?${params}`);
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
    `/api/backend/wishes/search?q=${encodeURIComponent(query.trim())}`
  );
  if (!response.ok) throw new Error("Failed to search books for wishes");
  return normalizeLocalMinioUrls(await response.json()) as WishSearchResult[];
}

export function useWantSearchResults(query: string) {
  const normalized = query.trim();
  return useQuery({
    queryKey: ["wish-search-results", normalized],
    queryFn: () => fetchWishSearchResults(normalized),
    enabled: normalized.length >= 2,
  });
}

// ─── Mutations ───────────────────────────────────────────────

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
export const useCreateWish = useCreateWant;
export const useConfirmWish = useConfirmWant;
export const useUpdateWish = useUpdateWant;
export const useDeleteWish = useDeleteWant;
