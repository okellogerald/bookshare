"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  StaffDirectoryEntry,
  StaffIdentitySearchResult,
} from "@/shared/api";

interface ManageStaffRoleInput {
  userId: string;
  role: string;
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

    throw new Error(getErrorMessage(payload, "Team request failed."));
  }

  return (await response.json()) as T;
}

async function fetchStaffDirectory(query: string): Promise<StaffDirectoryEntry[]> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("query", query.trim());
  }

  return requestJson<StaffDirectoryEntry[]>(
    `/api/backend/staff${params.toString() ? `?${params}` : ""}`
  );
}

async function searchStaffIdentities(query: string): Promise<StaffIdentitySearchResult[]> {
  const normalized = query.trim();
  if (normalized.length < 2) {
    return [];
  }

  const params = new URLSearchParams({ query: normalized });
  return requestJson<StaffIdentitySearchResult[]>(`/api/backend/staff/search?${params}`);
}

async function mutateStaffRole(method: "POST" | "DELETE", input: ManageStaffRoleInput) {
  return requestJson<{ ok: true; userId: string; role: string }>("/api/backend/staff/roles", {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function useTeamDirectory(query: string) {
  const normalized = query.trim();

  return useQuery({
    queryKey: ["admin-team-directory", normalized],
    queryFn: () => fetchStaffDirectory(normalized),
  });
}

export function useTeamIdentitySearch(query: string) {
  const normalized = query.trim();

  return useQuery({
    queryKey: ["admin-team-identity-search", normalized],
    queryFn: () => searchStaffIdentities(normalized),
    enabled: normalized.length >= 2,
  });
}

export function useGrantTeamRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ManageStaffRoleInput) => mutateStaffRole("POST", input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-team-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-team-identity-search"] }),
      ]);
    },
  });
}

export function useRevokeTeamRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ManageStaffRoleInput) => mutateStaffRole("DELETE", input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-team-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-team-identity-search"] }),
      ]);
    },
  });
}
