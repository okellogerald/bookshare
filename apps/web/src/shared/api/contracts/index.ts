/**
 * ts-rest contracts for NestJS write endpoints.
 *
 * These define the typed API contract for all mutation operations.
 * Read operations go through PostgREST, not NestJS.
 */

import { initContract } from "@ts-rest/core";

const c = initContract();

// ─── Request/Response Types ─────────────────────────────────

// Books
export interface CreateBookBody {
  title: string;
  subtitle?: string;
  description?: string;
  language?: string;
  authorIds?: string[];
  categoryIds?: string[];
}

export interface UpdateBookBody {
  title?: string;
  subtitle?: string;
  description?: string;
  language?: string;
  authorIds?: string[];
  categoryIds?: string[];
}

export interface BookResponse {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  language: string;
  createdAt: string;
  updatedAt: string;
}

// Authors
export interface CreateAuthorBody {
  name: string;
  bio?: string;
}

export interface UpdateAuthorBody {
  name?: string;
  bio?: string;
}

export interface AuthorResponse {
  id: string;
  name: string;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

// Editions
export interface CreateEditionBody {
  bookId: string;
  isbn?: string;
  format: string;
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
  coverImageUrl?: string;
}

export interface UpdateEditionBody {
  isbn?: string;
  format?: string;
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
  coverImageUrl?: string;
}

export interface EditionResponse {
  id: string;
  bookId: string;
  isbn: string | null;
  format: string;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Quotes
export interface CreateQuoteBody {
  editionId: string;
  text: string;
  chapter?: string;
}

export interface UpdateQuoteBody {
  text?: string;
  chapter?: string;
}

export interface QuoteResponse {
  id: string;
  editionId: string;
  text: string;
  chapter: string | null;
  addedBy: string;
  createdAt: string;
}

// Copies
export interface CreateCopyBody {
  editionId: string;
  condition: string;
  status?: string;
  acquisitionType: string;
  acquisitionDate?: string;
  location?: string;
  notes?: string;
  acquisitionAmount?: string;
  acquisitionCurrency?: string;
  shareType?: string;
  contactNote?: string;
}

export interface UpdateCopyBody {
  condition?: string;
  location?: string;
  notes?: string;
  shareType?: string;
  contactNote?: string;
}

export interface UpdateCopyStatusBody {
  status: string;
  amount?: string;
  currency?: string;
  notes?: string;
}

export interface CopyResponse {
  id: string;
  userId: string;
  editionId: string;
  condition: string;
  status: string;
  acquisitionType: string;
  acquisitionDate: string | null;
  location: string | null;
  notes: string | null;
  shareType: string | null;
  contactNote: string | null;
  lastConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Collections
export interface CreateCollectionBody {
  name: string;
  description?: string;
}

export interface UpdateCollectionBody {
  name?: string;
  description?: string;
}

export interface CollectionResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManageCopiesBody {
  copyIds: string[];
}

// Events
export interface AddEventNoteBody {
  copyId: string;
  notes: string;
}

export interface EventResponse {
  id: string;
  copyId: string;
  userId: string;
  eventType: string;
  notes: string | null;
  amount: string | null;
  currency: string | null;
  createdAt: string;
}

// Categories
export interface CreateCategoryBody {
  name: string;
  description?: string;
  parentId?: string;
}

export interface UpdateCategoryBody {
  name?: string;
  description?: string;
  parentId?: string;
}

export interface CategoryResponse {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Contracts ──────────────────────────────────────────────

export const booksContract = c.router({
  create: {
    method: "POST",
    path: "/api/nestjs/books",
    body: c.type<CreateBookBody>(),
    responses: { 201: c.type<BookResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/nestjs/books/:id",
    body: c.type<UpdateBookBody>(),
    responses: { 200: c.type<BookResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/nestjs/books/:id",
    body: null,
    responses: { 200: c.type<BookResponse>() },
  },
});

export const authorsContract = c.router({
  create: {
    method: "POST",
    path: "/api/nestjs/authors",
    body: c.type<CreateAuthorBody>(),
    responses: { 201: c.type<AuthorResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/nestjs/authors/:id",
    body: c.type<UpdateAuthorBody>(),
    responses: { 200: c.type<AuthorResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/nestjs/authors/:id",
    body: null,
    responses: { 200: c.type<AuthorResponse>() },
  },
});

export const editionsContract = c.router({
  create: {
    method: "POST",
    path: "/api/nestjs/editions",
    body: c.type<CreateEditionBody>(),
    responses: { 201: c.type<EditionResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/nestjs/editions/:id",
    body: c.type<UpdateEditionBody>(),
    responses: { 200: c.type<EditionResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/nestjs/editions/:id",
    body: null,
    responses: { 200: c.type<EditionResponse>() },
  },
});

export const quotesContract = c.router({
  create: {
    method: "POST",
    path: "/api/nestjs/quotes",
    body: c.type<CreateQuoteBody>(),
    responses: { 201: c.type<QuoteResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/nestjs/quotes/:id",
    body: c.type<UpdateQuoteBody>(),
    responses: { 200: c.type<QuoteResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/nestjs/quotes/:id",
    body: null,
    responses: { 200: c.type<QuoteResponse>() },
  },
});

export const copiesContract = c.router({
  create: {
    method: "POST",
    path: "/api/nestjs/copies",
    body: c.type<CreateCopyBody>(),
    responses: { 201: c.type<CopyResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/nestjs/copies/:id",
    body: c.type<UpdateCopyBody>(),
    responses: { 200: c.type<CopyResponse>() },
  },
  updateStatus: {
    method: "PATCH",
    path: "/api/nestjs/copies/:id/status",
    body: c.type<UpdateCopyStatusBody>(),
    responses: { 200: c.type<CopyResponse>() },
  },
  confirm: {
    method: "PATCH",
    path: "/api/nestjs/copies/:id/confirm",
    body: null,
    responses: { 200: c.type<CopyResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/nestjs/copies/:id",
    body: null,
    responses: { 200: c.type<CopyResponse>() },
  },
});

export const collectionsContract = c.router({
  create: {
    method: "POST",
    path: "/api/nestjs/collections",
    body: c.type<CreateCollectionBody>(),
    responses: { 201: c.type<CollectionResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/nestjs/collections/:id",
    body: c.type<UpdateCollectionBody>(),
    responses: { 200: c.type<CollectionResponse>() },
  },
  addCopies: {
    method: "POST",
    path: "/api/nestjs/collections/:id/copies",
    body: c.type<ManageCopiesBody>(),
    responses: { 201: c.type<CollectionResponse>() },
  },
  removeCopies: {
    method: "DELETE",
    path: "/api/nestjs/collections/:id/copies",
    body: c.type<ManageCopiesBody>(),
    responses: { 200: c.type<CollectionResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/nestjs/collections/:id",
    body: null,
    responses: { 200: c.type<CollectionResponse>() },
  },
});

export const eventsContract = c.router({
  addNote: {
    method: "POST",
    path: "/api/nestjs/events",
    body: c.type<AddEventNoteBody>(),
    responses: { 201: c.type<EventResponse>() },
  },
});

export const categoriesContract = c.router({
  create: {
    method: "POST",
    path: "/api/nestjs/categories",
    body: c.type<CreateCategoryBody>(),
    responses: { 201: c.type<CategoryResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/nestjs/categories/:id",
    body: c.type<UpdateCategoryBody>(),
    responses: { 200: c.type<CategoryResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/nestjs/categories/:id",
    body: null,
    responses: { 200: c.type<CategoryResponse>() },
  },
});

// Wants
export interface CreateWantBody {
  bookId: string;
  notes?: string;
}

export interface WantResponse {
  id: string;
  userId: string;
  bookId: string;
  notes: string | null;
  lastConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const wantsContract = c.router({
  create: {
    method: "POST",
    path: "/api/nestjs/wants",
    body: c.type<CreateWantBody>(),
    responses: { 201: c.type<WantResponse>() },
  },
  confirm: {
    method: "PATCH",
    path: "/api/nestjs/wants/:id/confirm",
    body: null,
    responses: { 200: c.type<WantResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/nestjs/wants/:id",
    body: null,
    responses: { 200: c.type<WantResponse>() },
  },
});

// ─── Combined Contract ──────────────────────────────────────

export const apiContract = c.router({
  books: booksContract,
  authors: authorsContract,
  editions: editionsContract,
  quotes: quotesContract,
  copies: copiesContract,
  collections: collectionsContract,
  events: eventsContract,
  categories: categoriesContract,
  wants: wantsContract,
});
