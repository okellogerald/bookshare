"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nestjsFetch } from "@/shared/lib/fetch";
import type {
  ProfileAvatarPresignBody,
  ProfileAvatarPresignResponse,
  ProfileResponse,
  UpdateProfileBody,
} from "./contracts";

// ─── Profile Queries ─────────────────────────────────────────

async function fetchMyProfile(): Promise<ProfileResponse> {
  return nestjsFetch<ProfileResponse>("profiles/me", "GET");
}

export function useMyProfile(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileBody) =>
      nestjsFetch<ProfileResponse>("profiles/me", "PUT", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["community-members"] });
    },
  });
}

export function useSyncMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => nestjsFetch<ProfileResponse>("profiles/sync", "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["community-members"] });
    },
  });
}

export function useCreateProfileAvatarPresign() {
  return useMutation({
    mutationFn: (body: ProfileAvatarPresignBody) =>
      nestjsFetch<ProfileAvatarPresignResponse>("upload/profile-avatar-presign", "POST", body),
  });
}

// ─── Account Management ──────────────────────────────────────

interface DeactivateAccountBody {
  confirmation: "DEACTIVATE";
  password: string;
}

interface DeleteAccountBody {
  confirmation: "DELETE";
  password: string;
}

interface DeactivateAccountResponse {
  deactivated: boolean;
  deactivatedAt?: string | null;
  identityProviderDeactivated?: boolean;
}

interface DeleteAccountResponse {
  deleted: boolean;
}

export function useDeactivateMyAccount() {
  return useMutation({
    mutationFn: (body: DeactivateAccountBody) =>
      nestjsFetch<DeactivateAccountResponse>("profiles/me/deactivate", "POST", body),
  });
}

export function useDeleteMyAccount() {
  return useMutation({
    mutationFn: (body: DeleteAccountBody) =>
      nestjsFetch<DeleteAccountResponse>("profiles/me", "DELETE", body),
  });
}
