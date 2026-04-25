"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface MemberProfileRecord {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  location: string | null;
  contact_notes: string | null;
  avatar_url: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberDirectoryEntry extends MemberProfileRecord {
  displayName: string;
  copyCount: number;
  activeWishCount: number;
  status: "active" | "deactivated";
}

interface PostgrestListResponse<T> {
  data?: T[];
}

export interface MemberPasswordResetResult {
  ok: true;
  userId: string;
  recoveryCode: string | null;
  recoveryLink: string | null;
  expiresAt: string | null;
}

export interface MemberActionResult {
  ok: true;
  userId: string;
  status?: "active" | "deactivated";
  deactivatedAt?: string | null;
  sessionsRevoked?: boolean;
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

    throw new Error(getErrorMessage(payload, "Member request failed."));
  }
  return (await response.json()) as T;
}

async function fetchMemberProfiles(): Promise<MemberProfileRecord[]> {
  const params = new URLSearchParams();
  params.set(
    "select",
    "user_id,email,first_name,last_name,location,contact_notes,avatar_url,deactivated_at,created_at,updated_at"
  );
  params.set("order", "created_at.desc");
  params.set("limit", "200");

  const json = await requestJson<PostgrestListResponse<MemberProfileRecord>>(
    `/api/backend/member_profiles?${params}`
  );
  return json.data ?? [];
}

async function fetchCopyOwners() {
  const params = new URLSearchParams();
  params.set("select", "user_id");
  params.set("limit", "1000");

  const json = await requestJson<PostgrestListResponse<{ user_id: string }>>(
    `/api/backend/copies?${params}`
  );
  return json.data ?? [];
}

async function fetchWishOwners() {
  const params = new URLSearchParams();
  params.set("select", "user_id,status");
  params.set("limit", "1000");

  const json = await requestJson<PostgrestListResponse<{ user_id: string; status: string }>>(
    `/api/backend/wishes?${params}`
  );
  return json.data ?? [];
}

function buildDisplayName(profile: MemberProfileRecord) {
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return fullName || profile.email || profile.user_id;
}

async function fetchMemberDirectory(): Promise<MemberDirectoryEntry[]> {
  const [profiles, copies, wishes] = await Promise.all([
    fetchMemberProfiles(),
    fetchCopyOwners(),
    fetchWishOwners(),
  ]);

  const copyCounts = new Map<string, number>();
  const activeWishCounts = new Map<string, number>();

  for (const copy of copies) {
    copyCounts.set(copy.user_id, (copyCounts.get(copy.user_id) ?? 0) + 1);
  }

  for (const wish of wishes) {
    if (wish.status !== "active") continue;
    activeWishCounts.set(wish.user_id, (activeWishCounts.get(wish.user_id) ?? 0) + 1);
  }

  return profiles.map((profile) => ({
    ...profile,
    displayName: buildDisplayName(profile),
    copyCount: copyCounts.get(profile.user_id) ?? 0,
    activeWishCount: activeWishCounts.get(profile.user_id) ?? 0,
    status: profile.deactivated_at ? "deactivated" : "active",
  }));
}

export function useMemberDirectory() {
  return useQuery({
    queryKey: ["admin-member-directory"],
    queryFn: fetchMemberDirectory,
  });
}

function mutateMemberAction<T>(
  userId: string,
  action: "password-reset" | "deactivate" | "reactivate" | "revoke-sessions",
  body?: Record<string, unknown>
) {
  return requestJson<T>(
    `/api/backend/profiles/admin/${encodeURIComponent(userId)}/${action}`,
    {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }
  );
}

export function useCreateMemberPasswordReset() {
  return useMutation({
    mutationFn: (userId: string) =>
      mutateMemberAction<MemberPasswordResetResult>(userId, "password-reset", {
        expiresIn: "1h",
      }),
  });
}

export function useDeactivateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      mutateMemberAction<MemberActionResult>(userId, "deactivate"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-member-directory"] });
    },
  });
}

export function useReactivateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      mutateMemberAction<MemberActionResult>(userId, "reactivate"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-member-directory"] });
    },
  });
}

export function useRevokeMemberSessions() {
  return useMutation({
    mutationFn: (userId: string) =>
      mutateMemberAction<MemberActionResult>(userId, "revoke-sessions"),
  });
}
