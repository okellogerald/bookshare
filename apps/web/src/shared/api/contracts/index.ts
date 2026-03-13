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
  notes?: string;
  shareType?: string;
  contactNote?: string;
}

export interface UpdateCopyBody {
  condition?: string;
  notes?: string;
  shareType?: string;
  contactNote?: string;
}

export interface UpdateCopyStatusBody {
  status: string;
  notes?: string;
  goneReason?: string;
  counterpartyType?: string;
  counterpartyUserId?: string;
  externalCounterpartyName?: string;
  externalCounterpartyContact?: string;
}

export interface AttachCopyImagesBody {
  images: Array<{
    objectKey: string;
    imageUrl: string;
    sortOrder?: number;
  }>;
}

export interface CopyImageResponse {
  id: string;
  copyId: string;
  userId: string;
  objectKey: string;
  imageUrl: string;
  sortOrder: number;
  createdAt: string;
}

export interface CopyResponse {
  id: string;
  userId: string;
  editionId: string;
  condition: string;
  status: string;
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

// Notifications
export interface NotificationResponse {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read: boolean;
  linkTo: string | null;
  createdAt: string;
}

export interface NotificationListQuery {
  limit?: number;
  offset?: number;
}

export interface NotificationListResponse {
  items: NotificationResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface UnreadNotificationsCountResponse {
  count: number;
}

export interface MarkAllNotificationsReadResponse {
  updated: number;
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
  attachImages: {
    method: "POST",
    path: "/api/nestjs/copies/:id/images",
    body: c.type<AttachCopyImagesBody>(),
    responses: { 201: c.type<CopyImageResponse[]>() },
  },
  removeImage: {
    method: "DELETE",
    path: "/api/nestjs/copies/:id/images/:imageId",
    body: null,
    responses: { 200: c.type<{ deleted: boolean }>() },
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

// Wishes
export interface CreateWishBody {
  bookId: string;
  notes?: string;
}

export interface UpdateWishBody {
  notes?: string;
}

export interface WishSearchResult {
  bookId: string;
  title: string;
  subtitle: string | null;
  authors: Array<{ id: string; name: string }>;
  editions: Array<{
    id: string;
    isbn: string | null;
    format: string;
    coverImageUrl: string | null;
  }>;
  primaryIsbn: string | null;
  hasEdition: boolean;
  hasCommunityCopy: boolean;
}

export interface WishResponse {
  id: string;
  userId: string;
  bookId: string;
  notes: string | null;
  status: "active" | "fulfilled" | "cancelled";
  closureReason:
    | "removed_by_wisher"
    | "matched_member_lent"
    | "matched_member_gone"
    | null;
  closedAt: string | null;
  fulfilledAt: string | null;
  fulfilledByCopyId: string | null;
  fulfilledByUserId: string | null;
  lastConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const wishesContract = c.router({
  search: {
    method: "GET",
    path: "/api/nestjs/wishes/search",
    responses: { 200: c.type<WishSearchResult[]>() },
  },
  create: {
    method: "POST",
    path: "/api/nestjs/wishes",
    body: c.type<CreateWishBody>(),
    responses: { 201: c.type<WishResponse>() },
  },
  confirm: {
    method: "PATCH",
    path: "/api/nestjs/wishes/:id/confirm",
    body: null,
    responses: { 200: c.type<WishResponse>() },
  },
  update: {
    method: "PATCH",
    path: "/api/nestjs/wishes/:id",
    body: c.type<UpdateWishBody>(),
    responses: { 200: c.type<WishResponse>() },
  },
  remove: {
    method: "DELETE",
    path: "/api/nestjs/wishes/:id",
    body: null,
    responses: { 200: c.type<{ deleted: boolean }>() },
  },
});

export type CreateWantBody = CreateWishBody;
export type UpdateWantBody = UpdateWishBody;
export type WantSearchResult = WishSearchResult;
export type WantResponse = WishResponse;
export const wantsContract = wishesContract;

export interface CreateCopySubmissionBody {
  title: string;
  authors: string[];
  isbn?: string;
  language?: string;
  bookDescriptionNotes?: string;
  condition?: string;
  shareType?: string;
  notes?: string;
  contactNote?: string;
  imageUrls?: string[];
}

export interface CreateMissingWantSubmissionBody {
  title: string;
  authors: string[];
  isbn?: string;
  language?: string;
  bookDescriptionNotes?: string;
  wantNotes?: string;
}

export interface SubmissionResponse {
  submitted: true;
}

export interface ProfileResponse {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  location: string | null;
  contactNotes: string | null;
  avatarUrl: string | null;
  deactivatedAt?: string | null;
  identityUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileBody {
  location?: string;
  contactNotes?: string;
  avatarUrl?: string | null;
}

export type IdentityGender =
  | "GENDER_UNSPECIFIED"
  | "GENDER_FEMALE"
  | "GENDER_MALE";

export interface UpdateProfileIdentityBody {
  firstName?: string;
  lastName?: string;
  gender?: IdentityGender;
}

export interface CopyImagePresignBody {
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface CopyImagePresignResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresInSeconds: number;
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

export interface ProfileAvatarPresignBody {
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface ProfileAvatarPresignResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export const profilesContract = c.router({
  sync: {
    method: "POST",
    path: "/api/nestjs/profiles/sync",
    body: null,
    responses: { 201: c.type<ProfileResponse>() },
  },
  getMe: {
    method: "GET",
    path: "/api/nestjs/profiles/me",
    responses: { 200: c.type<ProfileResponse>() },
  },
  updateMe: {
    method: "PUT",
    path: "/api/nestjs/profiles/me",
    body: c.type<UpdateProfileBody>(),
    responses: { 200: c.type<ProfileResponse>() },
  },
  updateMyIdentity: {
    method: "PUT",
    path: "/api/nestjs/profiles/me/identity",
    body: c.type<UpdateProfileIdentityBody>(),
    responses: { 200: c.type<ProfileResponse>() },
  },
});

export const notificationsContract = c.router({
  list: {
    method: "GET",
    path: "/api/nestjs/notifications",
    query: c.type<NotificationListQuery>(),
    responses: { 200: c.type<NotificationListResponse>() },
  },
  unreadCount: {
    method: "GET",
    path: "/api/nestjs/notifications/unread-count",
    responses: { 200: c.type<UnreadNotificationsCountResponse>() },
  },
  markRead: {
    method: "PATCH",
    path: "/api/nestjs/notifications/:id/read",
    body: null,
    responses: { 200: c.type<NotificationResponse>() },
  },
  markAllRead: {
    method: "PATCH",
    path: "/api/nestjs/notifications/read-all",
    body: null,
    responses: { 200: c.type<MarkAllNotificationsReadResponse>() },
  },
});

export const uploadContract = c.router({
  createCopyImagePresign: {
    method: "POST",
    path: "/api/nestjs/upload/copy-image-presign",
    body: c.type<CopyImagePresignBody>(),
    responses: { 201: c.type<CopyImagePresignResponse>() },
  },
  createSubmissionCopyImagePresign: {
    method: "POST",
    path: "/api/nestjs/upload/submission-copy-image-presign",
    body: c.type<CopyImagePresignBody>(),
    responses: { 201: c.type<CopyImagePresignResponse>() },
  },
  createEditionCoverPresign: {
    method: "POST",
    path: "/api/nestjs/upload/edition-cover-presign",
    body: c.type<EditionCoverPresignBody>(),
    responses: { 201: c.type<EditionCoverPresignResponse>() },
  },
  createProfileAvatarPresign: {
    method: "POST",
    path: "/api/nestjs/upload/profile-avatar-presign",
    body: c.type<ProfileAvatarPresignBody>(),
    responses: { 201: c.type<ProfileAvatarPresignResponse>() },
  },
});

export const submissionsContract = c.router({
  submitCopy: {
    method: "POST",
    path: "/api/nestjs/submissions/copy",
    body: c.type<CreateCopySubmissionBody>(),
    responses: { 201: c.type<SubmissionResponse>() },
  },
  submitMissingWant: {
    method: "POST",
    path: "/api/nestjs/submissions/want-missing",
    body: c.type<CreateMissingWantSubmissionBody>(),
    responses: { 201: c.type<SubmissionResponse>() },
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
  wishes: wishesContract,
  notifications: notificationsContract,
  submissions: submissionsContract,
  profiles: profilesContract,
  upload: uploadContract,
});
