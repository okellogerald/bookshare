"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PgWantWithBook } from "@/shared/api";
import type {
  CreateWantBody,
  UpdateWantBody,
  WantResponse,
  WantSearchResult,
} from "@/shared/api";
import { nestjsFetch } from "./fetch";

// ─── Queries ────────────────────────────────────────────────

async function fetchMyWants(): Promise<PgWantWithBook[]> {
  const params = new URLSearchParams();
  params.set("select", "*,book:books(*)");
  params.set("status", "in.(active,fulfilled)");
  params.set("order", "created_at.desc");

  const response = await fetch(`/api/postgrest/wants?${params}`);
  if (!response.ok) throw new Error("Failed to fetch wants");
  const json = await response.json();
  return json.data;
}

export function useMyWants() {
  return useQuery({
    queryKey: ["my-wants"],
    queryFn: fetchMyWants,
  });
}

async function fetchWantSearchResults(query: string): Promise<WantSearchResult[]> {
  const response = await fetch(
    `/api/nestjs/wants/search?q=${encodeURIComponent(query.trim())}`
  );
  if (!response.ok) throw new Error("Failed to search books for wants");
  return response.json();
}

export function useWantSearchResults(query: string) {
  const normalized = query.trim();
  return useQuery({
    queryKey: ["want-search-results", normalized],
    queryFn: () => fetchWantSearchResults(normalized),
    enabled: normalized.length >= 2,
  });
}

// ─── Mutations ──────────────────────────────────────────────

export function useCreateWant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWantBody) =>
      nestjsFetch<WantResponse>("wants", "POST", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wants"] });
      queryClient.invalidateQueries({ queryKey: ["browse-wants"] });
      queryClient.invalidateQueries({ queryKey: ["active-wanters"] });
    },
  });
}

export function useConfirmWant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      nestjsFetch<WantResponse>(`wants/${id}/confirm`, "PATCH"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wants"] });
      queryClient.invalidateQueries({ queryKey: ["browse-wants"] });
      queryClient.invalidateQueries({ queryKey: ["active-wanters"] });
    },
  });
}

export function useUpdateWant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateWantBody }) =>
      nestjsFetch<WantResponse>(`wants/${id}`, "PATCH", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wants"] });
      queryClient.invalidateQueries({ queryKey: ["browse-wants"] });
      queryClient.invalidateQueries({ queryKey: ["active-wanters"] });
      queryClient.invalidateQueries({ queryKey: ["want"] });
    },
  });
}

export function useDeleteWant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      nestjsFetch<{ deleted: boolean }>(`wants/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wants"] });
      queryClient.invalidateQueries({ queryKey: ["browse-wants"] });
      queryClient.invalidateQueries({ queryKey: ["active-wanters"] });
      queryClient.invalidateQueries({ queryKey: ["want"] });
    },
  });
}
