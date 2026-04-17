import { initContract } from "@ts-rest/core";

const c = initContract();

// ─── Copies ──────────────────────────────────────────────────

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

// ─── Collections ─────────────────────────────────────────────

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

// ─── Events ──────────────────────────────────────────────────

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

export const eventsContract = c.router({
  addNote: {
    method: "POST",
    path: "/api/nestjs/events",
    body: c.type<AddEventNoteBody>(),
    responses: { 201: c.type<EventResponse>() },
  },
});
