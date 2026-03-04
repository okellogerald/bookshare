"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PgCopyDetail, PgEdition } from "@/shared/api";
import type {
  CreateCopyBody,
  UpdateCopyBody,
  UpdateCopyStatusBody,
  CopyResponse,
  CreateBookBody,
  BookResponse,
  CreateEditionBody,
  EditionResponse,
} from "@/shared/api";
import { nestjsFetch } from "./fetch";

// ─── Queries ────────────────────────────────────────────────

async function fetchMyCopies(): Promise<PgCopyDetail[]> {
  const params = new URLSearchParams();
  params.set("select", "*,edition:editions(*,book:books(*))");
  params.set("order", "created_at.desc");

  const response = await fetch(`/api/postgrest/copies?${params}`);
  if (!response.ok) throw new Error("Failed to fetch copies");
  const json = await response.json();
  return json.data;
}

async function fetchEditionByIsbn(isbn: string): Promise<PgEdition | null> {
  const params = new URLSearchParams();
  params.set("isbn", `eq.${isbn}`);
  params.set("select", "*,book:books(*)");

  const response = await fetch(`/api/postgrest/editions?${params}`);
  if (!response.ok) throw new Error("Failed to search editions");
  const json = await response.json();
  return json.data?.[0] ?? null;
}

export function useMyCopies() {
  return useQuery({
    queryKey: ["my-copies"],
    queryFn: fetchMyCopies,
  });
}

export function useEditionByIsbn(isbn: string) {
  return useQuery({
    queryKey: ["edition-by-isbn", isbn],
    queryFn: () => fetchEditionByIsbn(isbn),
    enabled: isbn.length >= 10,
  });
}

// ─── Mutations ──────────────────────────────────────────────

export function useCreateCopy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCopyBody) =>
      nestjsFetch<CopyResponse>("copies", "POST", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-copies"] });
    },
  });
}

export function useUpdateCopy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCopyBody }) =>
      nestjsFetch<CopyResponse>(`copies/${id}`, "PUT", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-copies"] });
    },
  });
}

export function useUpdateCopyStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCopyStatusBody }) =>
      nestjsFetch<CopyResponse>(`copies/${id}/status`, "PATCH", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-copies"] });
      queryClient.invalidateQueries({ queryKey: ["browse-listings"] });
    },
  });
}

export function useConfirmCopy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      nestjsFetch<CopyResponse>(`copies/${id}/confirm`, "PATCH"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-copies"] });
      queryClient.invalidateQueries({ queryKey: ["browse-listings"] });
    },
  });
}

export function useDeleteCopy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      nestjsFetch<CopyResponse>(`copies/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-copies"] });
      queryClient.invalidateQueries({ queryKey: ["browse-listings"] });
    },
  });
}

// ─── Book + Edition Creation (for ISBN not found) ───────────

export function useCreateBook() {
  return useMutation({
    mutationFn: (body: CreateBookBody) =>
      nestjsFetch<BookResponse>("books", "POST", body),
  });
}

export function useCreateEdition() {
  return useMutation({
    mutationFn: (body: CreateEditionBody) =>
      nestjsFetch<EditionResponse>("editions", "POST", body),
  });
}
