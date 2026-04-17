import { initContract } from "@ts-rest/core";

const c = initContract();

// ─── Books ───────────────────────────────────────────────────

export interface CreateBookBody {
  title: string;
  subtitle?: string;
  language?: string;
  authorIds?: string[];
  categoryIds?: string[];
}

export interface UpdateBookBody {
  title?: string;
  subtitle?: string;
  language?: string;
  authorIds?: string[];
  categoryIds?: string[];
}

export interface BookResponse {
  id: string;
  title: string;
  subtitle: string | null;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export const booksContract = c.router({
  create: {
    method: "POST",
    path: "/api/backend/books",
    body: c.type<CreateBookBody>(),
    responses: { 201: c.type<BookResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/backend/books/:id",
    body: c.type<UpdateBookBody>(),
    responses: { 200: c.type<BookResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/backend/books/:id",
    body: null,
    responses: { 200: c.type<BookResponse>() },
  },
});

// ─── Authors ─────────────────────────────────────────────────

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

export const authorsContract = c.router({
  create: {
    method: "POST",
    path: "/api/backend/authors",
    body: c.type<CreateAuthorBody>(),
    responses: { 201: c.type<AuthorResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/backend/authors/:id",
    body: c.type<UpdateAuthorBody>(),
    responses: { 200: c.type<AuthorResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/backend/authors/:id",
    body: null,
    responses: { 200: c.type<AuthorResponse>() },
  },
});

// ─── Editions ────────────────────────────────────────────────

export interface CreateEditionBody {
  bookId: string;
  isbn?: string;
  format: string;
  description?: string;
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
  coverImageUrl?: string;
}

export interface UpdateEditionBody {
  isbn?: string;
  format?: string;
  description?: string;
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
  coverImageUrl?: string | null;
}

export interface EditionResponse {
  id: string;
  bookId: string;
  isbn: string | null;
  format: string;
  description: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditionCoverPresignBody {
  isbn: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface EditionCoverPresignResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export const editionsContract = c.router({
  create: {
    method: "POST",
    path: "/api/backend/editions",
    body: c.type<CreateEditionBody>(),
    responses: { 201: c.type<EditionResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/backend/editions/:id",
    body: c.type<UpdateEditionBody>(),
    responses: { 200: c.type<EditionResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/backend/editions/:id",
    body: null,
    responses: { 200: c.type<EditionResponse>() },
  },
});

// ─── Categories ──────────────────────────────────────────────

export interface CreateCategoryBody {
  themaCode: string;
  name: string;
}

export interface UpdateCategoryBody {
  name?: string;
}

export interface CategoryResponse {
  themaCode: string;
  name: string;
  createdAt: string;
}

export const categoriesContract = c.router({
  create: {
    method: "POST",
    path: "/api/backend/categories",
    body: c.type<CreateCategoryBody>(),
    responses: { 201: c.type<CategoryResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/backend/categories/:themaCode",
    body: c.type<UpdateCategoryBody>(),
    responses: { 200: c.type<CategoryResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/backend/categories/:themaCode",
    body: null,
    responses: { 200: c.type<CategoryResponse>() },
  },
});

// ─── Quotes ──────────────────────────────────────────────────

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

export const quotesContract = c.router({
  create: {
    method: "POST",
    path: "/api/backend/quotes",
    body: c.type<CreateQuoteBody>(),
    responses: { 201: c.type<QuoteResponse>() },
  },
  update: {
    method: "PUT",
    path: "/api/backend/quotes/:id",
    body: c.type<UpdateQuoteBody>(),
    responses: { 200: c.type<QuoteResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/backend/quotes/:id",
    body: null,
    responses: { 200: c.type<{ deleted: boolean }>() },
  },
});
