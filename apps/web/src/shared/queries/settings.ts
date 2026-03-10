"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProfileResponse } from "@/shared/api";
import { nestjsFetch } from "./fetch";

interface ChangeEmailBody {
  email: string;
}

interface ChangePasswordBody {
  oldPassword: string;
  newPassword: string;
}

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

export function useChangeMyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ChangeEmailBody) =>
      nestjsFetch<ProfileResponse>("profiles/me/email", "PUT", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["community-members"] });
    },
  });
}

export function useChangeMyPassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordBody) =>
      nestjsFetch<{ updated: boolean }>("profiles/me/password", "PUT", body),
  });
}

export function useDeactivateMyAccount() {
  return useMutation({
    mutationFn: (body: DeactivateAccountBody) =>
      nestjsFetch<DeactivateAccountResponse>(
        "profiles/me/deactivate",
        "POST",
        body
      ),
  });
}

export function useDeleteMyAccount() {
  return useMutation({
    mutationFn: (body: DeleteAccountBody) =>
      nestjsFetch<DeleteAccountResponse>("profiles/me", "DELETE", body),
  });
}
