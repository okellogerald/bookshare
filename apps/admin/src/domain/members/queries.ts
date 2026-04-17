"use client";

import { useQuery } from "@tanstack/react-query";

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

async function requestJson<T>(input: string): Promise<T> {
  const response = await fetch(input);
  if (!response.ok) {
    throw new Error("Failed to load member directory.");
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
