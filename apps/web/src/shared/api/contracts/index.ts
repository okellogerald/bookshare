/**
 * Assembles the combined ts-rest contract from domain-specific contracts.
 * All types and routers are re-exported for backward compatibility.
 */

import { initContract } from "@ts-rest/core";

const c = initContract();

// ─── Domain contracts ────────────────────────────────────────

export {
  booksContract,
  authorsContract,
  editionsContract,
  categoriesContract,
  quotesContract,
} from "@/domains/books/contracts";

export type {
  CreateBookBody,
  UpdateBookBody,
  BookResponse,
  CreateAuthorBody,
  UpdateAuthorBody,
  AuthorResponse,
  CreateEditionBody,
  UpdateEditionBody,
  EditionResponse,
  EditionCoverPresignBody,
  EditionCoverPresignResponse,
  CreateCategoryBody,
  UpdateCategoryBody,
  CategoryResponse,
  CreateQuoteBody,
  UpdateQuoteBody,
  QuoteResponse,
} from "@/domains/books/contracts";

export {
  copiesContract,
  collectionsContract,
  eventsContract,
} from "@/domains/library/contracts";

export type {
  CreateCopyBody,
  UpdateCopyBody,
  UpdateCopyStatusBody,
  AttachCopyImagesBody,
  CopyImageResponse,
  CopyResponse,
  CopyImagePresignBody,
  CopyImagePresignResponse,
  CreateCollectionBody,
  UpdateCollectionBody,
  CollectionResponse,
  ManageCopiesBody,
  AddEventNoteBody,
  EventResponse,
} from "@/domains/library/contracts";

export { wishesContract, wantsContract } from "@/domains/wishlist/contracts";

export type {
  CreateWishBody,
  UpdateWishBody,
  WishSearchResult,
  WishResponse,
  CreateWantBody,
  UpdateWantBody,
  WantSearchResult,
  WantResponse,
} from "@/domains/wishlist/contracts";

export { notificationsContract } from "@/domains/notifications/contracts";

export type {
  NotificationResponse,
  NotificationListQuery,
  NotificationListResponse,
  UnreadNotificationsCountResponse,
  MarkAllNotificationsReadResponse,
} from "@/domains/notifications/contracts";

export { profilesContract } from "@/domains/profile/contracts";

export type {
  ProfileResponse,
  UpdateProfileBody,
  UpdateProfileIdentityBody,
  IdentityGender,
  ProfileAvatarPresignBody,
  ProfileAvatarPresignResponse,
} from "@/domains/profile/contracts";

export { submissionsContract } from "@/domains/submissions/contracts";

export type {
  CreateCopySubmissionBody,
  CreateMissingWantSubmissionBody,
  SubmissionResponse,
} from "@/domains/submissions/contracts";

// ─── Upload contract (cross-cutting) ────────────────────────

import type {
  CopyImagePresignBody,
  CopyImagePresignResponse,
} from "@/domains/library/contracts";
import type {
  EditionCoverPresignBody,
  EditionCoverPresignResponse,
} from "@/domains/books/contracts";
import type {
  ProfileAvatarPresignBody,
  ProfileAvatarPresignResponse,
} from "@/domains/profile/contracts";

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

// ─── Combined contract ───────────────────────────────────────

import {
  booksContract as _books,
  authorsContract as _authors,
  editionsContract as _editions,
  quotesContract as _quotes,
  categoriesContract as _categories,
} from "@/domains/books/contracts";
import {
  copiesContract as _copies,
  collectionsContract as _collections,
  eventsContract as _events,
} from "@/domains/library/contracts";
import { wishesContract as _wishes } from "@/domains/wishlist/contracts";
import { notificationsContract as _notifications } from "@/domains/notifications/contracts";
import { submissionsContract as _submissions } from "@/domains/submissions/contracts";
import { profilesContract as _profiles } from "@/domains/profile/contracts";

export const apiContract = c.router({
  books: _books,
  authors: _authors,
  editions: _editions,
  quotes: _quotes,
  copies: _copies,
  collections: _collections,
  events: _events,
  categories: _categories,
  wishes: _wishes,
  notifications: _notifications,
  submissions: _submissions,
  profiles: _profiles,
  upload: uploadContract,
});
