"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ProfileAvatarPresignBody,
  ProfileAvatarPresignResponse,
  ProfileResponse,
  UpdateProfileBody,
  UpdateProfileIdentityBody,
} from "@/shared/api";
import { nestjsFetch } from "./fetch";

async function fetchMyProfile(): Promise<ProfileResponse> {
  return nestjsFetch<ProfileResponse>("profiles/me", "GET");
}

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
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

export function useUpdateMyIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileIdentityBody) =>
      nestjsFetch<ProfileResponse>("profiles/me/identity", "PUT", body),
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
      nestjsFetch<ProfileAvatarPresignResponse>(
        "upload/profile-avatar-presign",
        "POST",
        body
      ),
  });
}
