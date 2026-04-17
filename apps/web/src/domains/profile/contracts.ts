import { initContract } from "@ts-rest/core";

const c = initContract();

// ─── Profiles ────────────────────────────────────────────────

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
    path: "/api/backend/profiles/sync",
    body: null,
    responses: { 201: c.type<ProfileResponse>() },
  },
  getMe: {
    method: "GET",
    path: "/api/backend/profiles/me",
    responses: { 200: c.type<ProfileResponse>() },
  },
  updateMe: {
    method: "PUT",
    path: "/api/backend/profiles/me",
    body: c.type<UpdateProfileBody>(),
    responses: { 200: c.type<ProfileResponse>() },
  },
  updateMyIdentity: {
    method: "PUT",
    path: "/api/backend/profiles/me/identity",
    body: c.type<UpdateProfileIdentityBody>(),
    responses: { 200: c.type<ProfileResponse>() },
  },
});
