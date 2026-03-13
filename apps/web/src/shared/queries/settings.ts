"use client";

import { useMutation } from "@tanstack/react-query";
import { nestjsFetch } from "./fetch";

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
