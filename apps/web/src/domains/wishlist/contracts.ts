import { initContract } from "@ts-rest/core";

const c = initContract();

// ─── Wishes / Wants ──────────────────────────────────────────

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
