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
  PgMemberProfile,
  PgCopyImage,
  PgBrowseListing,
  PgWant,
  PgWantWithBook,
  PgBrowseWant,
  // Joined / embedded types
  PgBookWithAuthors,
  PgBookWithAuthorsView,
  PgBookWithCategories,
  PgBookWithCategoriesView,
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
  profilesContract,
  uploadContract,
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
  AttachCopyImagesBody,
  CopyImageResponse,
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
  ProfileResponse,
  UpdateProfileBody,
  UpdateProfileIdentityBody,
  IdentityGender,
  CopyImagePresignBody,
  CopyImagePresignResponse,
  EditionCoverPresignBody,
  EditionCoverPresignResponse,
  ProfileAvatarPresignBody,
  ProfileAvatarPresignResponse,
} from "./contracts";

// ─── NestJS client (ts-rest) ─────────────────────────────────
export { createApiClient, api } from "./nestjs/client";
