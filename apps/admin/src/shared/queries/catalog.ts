"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PgBookWithAuthorsView } from "@/shared/api";

// ─── Helpers ────────────────────────────────────────────────

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim().length > 0) return payload;
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
    if (Array.isArray(message) && typeof message[0] === "string" && message[0].trim().length > 0) return message[0];
  }
  return fallback;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    let payload: unknown = null;
    try { payload = await response.json(); } catch { payload = await response.text(); }
    throw new Error(getErrorMessage(payload, "Catalog request failed."));
  }
  return (await response.json()) as T;
}

// ─── Search ─────────────────────────────────────────────────

async function fetchCatalogBooks(query: string): Promise<PgBookWithAuthorsView[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const params = new URLSearchParams();
  params.set("select", "id,title,subtitle,language,authors");
  params.set("order", "title.asc");
  params.set("limit", "20");
  params.set("or", `(title.ilike.*${normalized}*,subtitle.ilike.*${normalized}*)`);

  const response = await fetch(`/api/postgrest/books_with_authors?${params}`);
  if (!response.ok) throw new Error("Failed to search catalog");
  const json = await response.json();
  return (json.data ?? []) as PgBookWithAuthorsView[];
}

export function useCatalogBookSearch(query: string) {
  const normalized = query.trim();

  return useQuery({
    queryKey: ["admin-catalog-book-search", normalized],
    queryFn: () => fetchCatalogBooks(normalized),
    enabled: normalized.length >= 2,
  });
}

// ─── Summary counts ─────────────────────────────────────────

interface PostgrestListResponse<T> {
  data?: T[];
  count?: number;
}

export interface CatalogSummaryCounts {
  titles: number | null;
  editions: number | null;
  copies: number | null;
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
  const [titles, editions, copies] = await Promise.allSettled([
    fetchPostgrestCount("books"),
    fetchPostgrestCount("editions"),
    fetchPostgrestCount("copies"),
  ]);

  return {
    titles: titles.status === "fulfilled" ? titles.value : null,
    editions: editions.status === "fulfilled" ? editions.value : null,
    copies: copies.status === "fulfilled" ? copies.value : null,
  };
}

export function useCatalogSummaryCounts() {
  return useQuery({
    queryKey: ["admin-catalog-summary-counts"],
    queryFn: fetchCatalogSummaryCounts,
  });
}

// ─── Create Book ────────────────────────────────────────────

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

async function createBook(input: CreateBookInput): Promise<CreateBookResult> {
  return requestJson<CreateBookResult>("/api/nestjs/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function useCreateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-catalog-book-search"] });
      queryClient.invalidateQueries({ queryKey: ["admin-catalog-summary-counts"] });
    },
  });
}

// ─── Create Edition ─────────────────────────────────────────

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

async function createEdition(input: CreateEditionInput): Promise<CreateEditionResult> {
  return requestJson<CreateEditionResult>("/api/nestjs/editions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function useCreateEdition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEdition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-catalog-summary-counts"] });
    },
  });
}

// ─── Edition Cover Presign ──────────────────────────────────

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

async function createEditionCoverPresign(
  input: EditionCoverPresignInput
): Promise<EditionCoverPresignResult> {
  return requestJson<EditionCoverPresignResult>(
    "/api/nestjs/upload/edition-cover-presign",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
}

export function useEditionCoverPresign() {
  return useMutation({
    mutationFn: createEditionCoverPresign,
  });
}

// ─── Upload file to presigned URL ───────────────────────────

export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!response.ok) {
    throw new Error("Failed to upload cover image.");
  }
}

// ─── Author Search ──────────────────────────────────────────

export interface AuthorRecord {
  id: string;
  name: string;
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
  if (!response.ok) throw new Error("Failed to search authors");
  const json = await response.json();
  return (json.data ?? []) as AuthorRecord[];
}

export function useAuthorSearch(query: string) {
  const normalized = query.trim();

  return useQuery({
    queryKey: ["admin-author-search", normalized],
    queryFn: () => fetchAuthors(normalized),
    enabled: normalized.length >= 2,
  });
}

// ─── Create Author ──────────────────────────────────────────

async function createAuthor(name: string): Promise<AuthorRecord> {
  return requestJson<AuthorRecord>("/api/nestjs/authors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export function useCreateAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAuthor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-author-search"] });
    },
  });
}
