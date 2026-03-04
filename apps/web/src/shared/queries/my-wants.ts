"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PgWantWithBook } from "@/shared/api";
import type { CreateWantBody, WantResponse } from "@/shared/api";

// ─── Fetch helpers ──────────────────────────────────────────

async function nestjsFetch<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`/api/nestjs/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error (${res.status}): ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Queries ────────────────────────────────────────────────

async function fetchMyWants(): Promise<PgWantWithBook[]> {
  const params = new URLSearchParams();
  params.set("select", "*,book:books(*)");
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

// Re-export for the add want page (ISBN → book lookup)
export { useEditionByIsbn } from "./my-library";

// ─── Mutations ──────────────────────────────────────────────

export function useCreateWant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWantBody) =>
      nestjsFetch<WantResponse>("wants", "POST", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wants"] });
      queryClient.invalidateQueries({ queryKey: ["browse-wants"] });
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
    },
  });
}

export function useDeleteWant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      nestjsFetch<WantResponse>(`wants/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wants"] });
      queryClient.invalidateQueries({ queryKey: ["browse-wants"] });
    },
  });
}
