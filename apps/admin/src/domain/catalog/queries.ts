"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PgBookWithAuthorsView } from "@/shared/api";

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim().length > 0) return payload;
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
    if (Array.isArray(message) && typeof message[0] === "string" && message[0].trim().length > 0) {
      return message[0];
    }
  }
  return fallback;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }
    throw new Error(getErrorMessage(payload, "Catalog request failed."));
  }
  return (await response.json()) as T;
}

interface PostgrestListResponse<T> {
  data?: T[];
  count?: number;
}

export interface CatalogSummaryCounts {
  titles: number | null;
  editions: number | null;
  copies: number | null;
  wishes: number | null;
}

export interface CatalogBookRecord {
  id: string;
  title: string;
  subtitle: string | null;
  language: string;
}

export interface CatalogEditionRecord {
  id: string;
  isbn: string | null;
  format: string;
  description: string | null;
  publisher: string | null;
  published_year: number | null;
  page_count: number | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  book: CatalogBookRecord | null;
}

export interface CatalogCopyRecord {
  id: string;
  user_id: string;
  condition: string;
  status: string;
  share_type: string | null;
  contact_note: string | null;
  last_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  edition:
    | (CatalogEditionRecord & {
        book: CatalogBookRecord | null;
      })
    | null;
}

export interface CatalogWishRecord {
  id: string;
  user_id: string;
  notes: string | null;
  status: "active" | "fulfilled" | "cancelled";
  created_at: string;
  updated_at: string;
  last_confirmed_at: string | null;
  book: CatalogBookRecord | null;
  edition: Pick<CatalogEditionRecord, "id" | "isbn" | "format"> | null;
}

export interface CreateBookInput {
  title: string;
  subtitle?: string;
  language?: string;
  authorIds?: string[];
}

interface CreateBookResult {
  id: string;
  title: string;
  subtitle: string | null;
  language: string;
}

export interface CreateEditionInput {
  bookId: string;
  isbn?: string;
  format: "hardcover" | "paperback" | "mass_market";
  description?: string;
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
  coverImageUrl?: string;
}

interface CreateEditionResult {
  id: string;
  bookId: string;
  isbn: string | null;
  format: string;
}

export interface EditionCoverPresignInput {
  isbn: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

interface EditionCoverPresignResult {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export interface AuthorRecord {
  id: string;
  name: string;
}

async function fetchCatalogBooks(query: string): Promise<PgBookWithAuthorsView[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const params = new URLSearchParams();
  params.set("select", "id,title,subtitle,language,authors");
  params.set("order", "title.asc");
  params.set("limit", "20");
  params.set("or", `(title.ilike.*${normalized}*,subtitle.ilike.*${normalized}*)`);

  const response = await fetch(`/api/postgrest/books_with_authors?${params}`);
  if (!response.ok) throw new Error("Failed to search catalog.");
  const json = await response.json();
  return (json.data ?? []) as PgBookWithAuthorsView[];
}

async function fetchPostgrestCount(path: string): Promise<number> {
  const params = new URLSearchParams();
  params.set("select", "id");
  params.set("limit", "1");

  const response = await fetch(`/api/postgrest/${path}?${params}`, {
    headers: {
      Prefer: "count=exact",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${path} count.`);
  }

  const json = (await response.json()) as PostgrestListResponse<unknown>;
  return typeof json.count === "number" ? json.count : (json.data?.length ?? 0);
}

async function fetchCatalogSummaryCounts(): Promise<CatalogSummaryCounts> {
  const [titles, editions, copies, wishes] = await Promise.allSettled([
    fetchPostgrestCount("books"),
    fetchPostgrestCount("editions"),
    fetchPostgrestCount("copies"),
    fetchPostgrestCount("wishes"),
  ]);

  return {
    titles: titles.status === "fulfilled" ? titles.value : null,
    editions: editions.status === "fulfilled" ? editions.value : null,
    copies: copies.status === "fulfilled" ? copies.value : null,
    wishes: wishes.status === "fulfilled" ? wishes.value : null,
  };
}

async function fetchCatalogEditions(limit = 40): Promise<CatalogEditionRecord[]> {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,isbn,format,description,publisher,published_year,page_count,cover_image_url,created_at,updated_at,book:books(id,title,subtitle,language)"
  );
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));

  const response = await fetch(`/api/postgrest/editions?${params}`);
  if (!response.ok) throw new Error("Failed to load editions.");
  const json = await response.json();
  return (json.data ?? []) as CatalogEditionRecord[];
}

async function fetchCatalogCopies(limit = 40): Promise<CatalogCopyRecord[]> {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,user_id,condition,status,share_type,contact_note,last_confirmed_at,created_at,updated_at,edition:editions(id,isbn,format,description,publisher,published_year,page_count,cover_image_url,created_at,updated_at,book:books(id,title,subtitle,language))"
  );
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));

  const response = await fetch(`/api/postgrest/copies?${params}`);
  if (!response.ok) throw new Error("Failed to load copies.");
  const json = await response.json();
  return (json.data ?? []) as CatalogCopyRecord[];
}

async function fetchCatalogWishes(limit = 40): Promise<CatalogWishRecord[]> {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,user_id,notes,status,created_at,updated_at,last_confirmed_at,book:books(id,title,subtitle,language),edition:editions(id,isbn,format)"
  );
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));

  const response = await fetch(`/api/postgrest/wishes?${params}`);
  if (!response.ok) throw new Error("Failed to load wishes.");
  const json = await response.json();
  return (json.data ?? []) as CatalogWishRecord[];
}

async function createBook(input: CreateBookInput): Promise<CreateBookResult> {
  return requestJson<CreateBookResult>("/api/nestjs/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function createEdition(input: CreateEditionInput): Promise<CreateEditionResult> {
  return requestJson<CreateEditionResult>("/api/nestjs/editions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function createEditionCoverPresign(
  input: EditionCoverPresignInput
): Promise<EditionCoverPresignResult> {
  return requestJson<EditionCoverPresignResult>("/api/nestjs/upload/edition-cover-presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function fetchAuthors(query: string): Promise<AuthorRecord[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const params = new URLSearchParams();
  params.set("select", "id,name");
  params.set("order", "name.asc");
  params.set("limit", "15");
  params.set("name", `ilike.*${normalized}*`);

  const response = await fetch(`/api/postgrest/authors?${params}`);
  if (!response.ok) throw new Error("Failed to search authors.");
  const json = await response.json();
  return (json.data ?? []) as AuthorRecord[];
}

async function createAuthor(name: string): Promise<AuthorRecord> {
  return requestJson<AuthorRecord>("/api/nestjs/authors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

async function fetchCatalogBooksList(limit = 60): Promise<PgBookWithAuthorsView[]> {
  const params = new URLSearchParams();
  params.set("select", "id,title,subtitle,language,authors");
  params.set("order", "title.asc");
  params.set("limit", String(limit));

  const response = await fetch(`/api/postgrest/books_with_authors?${params}`);
  if (!response.ok) throw new Error("Failed to load books.");
  const json = await response.json();
  return (json.data ?? []) as PgBookWithAuthorsView[];
}

export function useCatalogBooks(limit = 60) {
  return useQuery({
    queryKey: ["admin-catalog-books", limit],
    queryFn: () => fetchCatalogBooksList(limit),
  });
}

export function useCatalogBookSearch(query: string) {
  const normalized = query.trim();

  return useQuery({
    queryKey: ["admin-catalog-book-search", normalized],
    queryFn: () => fetchCatalogBooks(normalized),
    enabled: normalized.length >= 2,
  });
}

export function useCatalogSummaryCounts() {
  return useQuery({
    queryKey: ["admin-catalog-summary-counts"],
    queryFn: fetchCatalogSummaryCounts,
  });
}

export function useCatalogEditions(limit = 40) {
  return useQuery({
    queryKey: ["admin-catalog-editions", limit],
    queryFn: () => fetchCatalogEditions(limit),
  });
}

export function useCatalogCopies(limit = 40) {
  return useQuery({
    queryKey: ["admin-catalog-copies", limit],
    queryFn: () => fetchCatalogCopies(limit),
  });
}

export function useCatalogWishes(limit = 40) {
  return useQuery({
    queryKey: ["admin-catalog-wishes", limit],
    queryFn: () => fetchCatalogWishes(limit),
  });
}

export function useCreateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBook,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-catalog-book-search"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-catalog-summary-counts"] }),
      ]);
    },
  });
}

export function useCreateEdition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEdition,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-catalog-summary-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-catalog-editions"] }),
      ]);
    },
  });
}

export function useEditionCoverPresign() {
  return useMutation({
    mutationFn: createEditionCoverPresign,
  });
}

export async function uploadToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!response.ok) {
    throw new Error("Failed to upload cover image.");
  }
}

export function useAuthorSearch(query: string) {
  const normalized = query.trim();

  return useQuery({
    queryKey: ["admin-author-search", normalized],
    queryFn: () => fetchAuthors(normalized),
    enabled: normalized.length >= 2,
  });
}

export function useCreateAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAuthor,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-author-search"] });
    },
  });
}
