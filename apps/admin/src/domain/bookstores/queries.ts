"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminBookstoreCreateResult,
  AdminBookstoreDetail,
  AdminBookstoreResendOwnerEmailResult,
  AdminBookstoreSummary,
  BookstoreStatus,
} from "@bookshare/shared";

interface AdminBookstoresQuery {
  status?: "all" | BookstoreStatus;
  query?: string;
}

interface UpdateAdminBookstoreStatusInput {
  status: BookstoreStatus;
  reviewNote?: string;
}

export interface CreateAdminBookstoreInput {
  name: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  websiteUrl?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  address?: string;
  contactNote?: string;
}

export interface UpdateAdminBookstoreInput {
  name?: string;
  websiteUrl?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  address?: string;
  contactNote?: string;
}

export interface UpdateAdminBookstoreOwnerInput {
  ownerEmail?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    if (
      Array.isArray(message) &&
      typeof message[0] === "string" &&
      message[0].trim().length > 0
    ) {
      return message[0];
    }
  }

  return fallback;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }

    throw new Error(getErrorMessage(payload, "Bookstore request failed."));
  }

  return (await response.json()) as T;
}

function toQueryString(query: AdminBookstoresQuery) {
  const params = new URLSearchParams();
  if (query.status && query.status !== "all") {
    params.set("status", query.status);
  }
  if (query.query?.trim()) {
    params.set("query", query.query.trim());
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

async function fetchAdminBookstores(query: AdminBookstoresQuery) {
  return requestJson<AdminBookstoreSummary[]>(
    `/api/backend/bookstores/admin${toQueryString(query)}`
  );
}

async function fetchAdminBookstore(bookstoreId: string) {
  return requestJson<AdminBookstoreDetail>(`/api/backend/bookstores/admin/${bookstoreId}`);
}

export function useAdminBookstores(query: AdminBookstoresQuery) {
  return useQuery({
    queryKey: ["admin-bookstores", query.status ?? "all", query.query ?? ""],
    queryFn: () => fetchAdminBookstores(query),
  });
}

export function useAdminBookstore(bookstoreId: string | null) {
  return useQuery({
    queryKey: ["admin-bookstores", bookstoreId],
    queryFn: () => fetchAdminBookstore(bookstoreId!),
    enabled: !!bookstoreId,
  });
}

export function useAdminCreateBookstore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAdminBookstoreInput) =>
      requestJson<AdminBookstoreCreateResult>(`/api/backend/bookstores/admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-bookstores"] });
    },
  });
}

export function useAdminUpdateBookstoreStatus(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAdminBookstoreStatusInput) =>
      requestJson<AdminBookstoreDetail>(`/api/backend/bookstores/admin/${bookstoreId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-bookstores"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-bookstores", bookstoreId] }),
      ]);
    },
  });
}

export function useAdminUpdateBookstore(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAdminBookstoreInput) =>
      requestJson<AdminBookstoreDetail>(`/api/backend/bookstores/admin/${bookstoreId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-bookstores"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-bookstores", bookstoreId] }),
      ]);
    },
  });
}

export function useAdminUpdateBookstoreOwner(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAdminBookstoreOwnerInput) =>
      requestJson<AdminBookstoreDetail>(`/api/backend/bookstores/admin/${bookstoreId}/owner`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-bookstores"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-bookstores", bookstoreId] }),
      ]);
    },
  });
}

export function useAdminResendBookstoreOwnerEmail(bookstoreId: string) {
  return useMutation({
    mutationFn: () =>
      requestJson<AdminBookstoreResendOwnerEmailResult>(
        `/api/backend/bookstores/admin/${bookstoreId}/owner/resend-email`,
        {
          method: "POST",
        }
      ),
  });
}
