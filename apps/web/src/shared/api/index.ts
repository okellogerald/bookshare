// ─── PostgREST (reads) ───────────────────────────────────────
export { postgrestAuth, postgrestPublic } from "./postgrest/client";
export { PostgRESTError } from "./postgrest/client";
export type { PostgRESTOptions, PostgRESTResponse } from "./postgrest/client";

export type {
  // Base table types
  PgBook,
  PgAuthor,
  PgEdition,
  PgBookQuote,
  PgBookQuoteWithBook,
  PgCategory,
  PgCopy,
  PgCopyEvent,
  PgCollection,
  PgBrowseListing,
  PgWant,
  PgBrowseWant,
  // Joined / embedded types
  PgBookWithAuthors,
  PgBookWithCategories,
  PgEditionWithBook,
  PgCopyDetail,
  PgCopyEventDetail,
  PgCategoryTree,
  // Convenience aliases used by the query layer
  PgQuote,
  PgCopyWithDetails,
  PgCategoryWithParent,
  PgCollectionWithCopies,
  PgCopyEventWithCopy,
} from "./postgrest/types";

// ─── Contracts (writes) ──────────────────────────────────────
export { apiContract } from "./contracts";
export {
  booksContract,
  authorsContract,
  editionsContract,
  quotesContract,
  copiesContract,
  collectionsContract,
  eventsContract,
  categoriesContract,
  wantsContract,
} from "./contracts";

export type {
  // Books
  CreateBookBody,
  UpdateBookBody,
  BookResponse,
  // Authors
  CreateAuthorBody,
  UpdateAuthorBody,
  AuthorResponse,
  // Editions
  CreateEditionBody,
  UpdateEditionBody,
  EditionResponse,
  // Quotes
  CreateQuoteBody,
  UpdateQuoteBody,
  QuoteResponse,
  // Copies
  CreateCopyBody,
  UpdateCopyBody,
  UpdateCopyStatusBody,
  CopyResponse,
  // Collections
  CreateCollectionBody,
  UpdateCollectionBody,
  CollectionResponse,
  ManageCopiesBody,
  // Events
  AddEventNoteBody,
  EventResponse,
  // Categories
  CreateCategoryBody,
  UpdateCategoryBody,
  CategoryResponse,
  // Wants
  CreateWantBody,
  WantResponse,
} from "./contracts";

// ─── NestJS client (ts-rest) ─────────────────────────────────
export { createApiClient, api } from "./nestjs/client";
