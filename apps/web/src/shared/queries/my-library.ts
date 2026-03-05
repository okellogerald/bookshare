"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PgCopyDetail, PgEdition, PgAuthor, PgBookWithAuthorsView } from "@/shared/api";
import type {
  AttachCopyImagesBody,
  CopyImagePresignBody,
  CopyImagePresignResponse,
  CopyImageResponse,
  CreateCopyBody,
  UpdateCopyBody,
  UpdateCopyStatusBody,
  CopyResponse,
  CreateBookBody,
  UpdateBookBody,
  BookResponse,
  CreateEditionBody,
  UpdateEditionBody,
  EditionResponse,
  CreateAuthorBody,
  AuthorResponse,
} from "@/shared/api";
import { nestjsFetch } from "./fetch";

// ─── Queries ────────────────────────────────────────────────

async function fetchMyCopies(): Promise<PgCopyDetail[]> {
  const params = new URLSearchParams();
  params.set("select", "*,edition:editions(*,book:books(*)),images:copy_images(*)");
  params.set("order", "created_at.desc");

  const response = await fetch(`/api/postgrest/copies?${params}`);
  if (!response.ok) throw new Error("Failed to fetch copies");
  const json = await response.json();
  return json.data;
}

async function fetchMyActiveOwnedBookIds(): Promise<string[]> {
  const params = new URLSearchParams();
  params.set("select", "edition:editions(book_id)");
  params.set("status", "in.(available,reserved,lent,checked_out)");

  const response = await fetch(`/api/postgrest/copies?${params}`);
  if (!response.ok) throw new Error("Failed to fetch active owned books");
  const json = await response.json();
  const rows = json.data as Array<{ edition?: { book_id?: string } }>;
  return Array.from(
    new Set(
      rows
        .map((row) => row.edition?.book_id)
        .filter((bookId): bookId is string => !!bookId)
    )
  );
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

export function useMyActiveOwnedBookIds() {
  return useQuery({
    queryKey: ["my-active-owned-book-ids"],
    queryFn: fetchMyActiveOwnedBookIds,
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
      queryClient.invalidateQueries({ queryKey: ["my-active-owned-book-ids"] });
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
      queryClient.invalidateQueries({ queryKey: ["copy"] });
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
      queryClient.invalidateQueries({ queryKey: ["copy"] });
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
      queryClient.invalidateQueries({ queryKey: ["my-active-owned-book-ids"] });
    },
  });
}

export function useAttachCopyImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: AttachCopyImagesBody;
    }) => nestjsFetch<CopyImageResponse[]>(`copies/${id}/images`, "POST", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-copies"] });
      queryClient.invalidateQueries({ queryKey: ["browse-listings"] });
      queryClient.invalidateQueries({ queryKey: ["my-active-owned-book-ids"] });
    },
  });
}

export function useDeleteCopyImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, imageId }: { id: string; imageId: string }) =>
      nestjsFetch<{ deleted: boolean }>(`copies/${id}/images/${imageId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-copies"] });
      queryClient.invalidateQueries({ queryKey: ["browse-listings"] });
      queryClient.invalidateQueries({ queryKey: ["my-active-owned-book-ids"] });
    },
  });
}

export function useCreateCopyImagePresign() {
  return useMutation({
    mutationFn: (body: CopyImagePresignBody) =>
      nestjsFetch<CopyImagePresignResponse>("upload/copy-image-presign", "POST", body),
  });
}

// ─── Book + Edition + Author Creation (for ISBN not found) ──

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

export function useCreateAuthor() {
  return useMutation({
    mutationFn: (body: CreateAuthorBody) =>
      nestjsFetch<AuthorResponse>("authors", "POST", body),
  });
}

async function searchAuthorsByName(name: string): Promise<PgAuthor[]> {
  const params = new URLSearchParams();
  params.set("name", `ilike.*${name}*`);
  params.set("order", "name.asc");

  const response = await fetch(`/api/postgrest/authors?${params}`);
  if (!response.ok) throw new Error("Failed to search authors");
  const json = await response.json();
  return json.data;
}

export function useSearchAuthors(name: string) {
  return useQuery({
    queryKey: ["search-authors", name],
    queryFn: () => searchAuthorsByName(name),
    enabled: name.length >= 2,
  });
}

// ─── Book & Edition Updates ─────────────────────────────────

export function useUpdateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBookBody }) =>
      nestjsFetch<BookResponse>(`books/${id}`, "PUT", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-copies"] });
      queryClient.invalidateQueries({ queryKey: ["browse-listings"] });
      queryClient.invalidateQueries({ queryKey: ["book-with-authors"] });
    },
  });
}

export function useUpdateEdition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateEditionBody }) =>
      nestjsFetch<EditionResponse>(`editions/${id}`, "PUT", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-copies"] });
      queryClient.invalidateQueries({ queryKey: ["browse-listings"] });
    },
  });
}

// ─── Book with Authors (for edit form pre-population) ───────

async function fetchBookWithAuthors(
  bookId: string
): Promise<PgBookWithAuthorsView | null> {
  const params = new URLSearchParams();
  params.set("id", `eq.${bookId}`);

  const response = await fetch(
    `/api/postgrest/books_with_authors?${params}`
  );
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
