"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PgMemberProfile, ProfileResponse, UpdateProfileBody } from "@/shared/api";
import { nestjsFetch } from "./fetch";

interface CommunityFilters {
  search?: string;
}

async function fetchCommunityMembers(
  filters: CommunityFilters
): Promise<PgMemberProfile[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "username.asc");

  if (filters.search) {
    params.set(
      "or",
      `(username.ilike.*${filters.search}*,display_name.ilike.*${filters.search}*,city_area.ilike.*${filters.search}*)`
    );
  }

  const response = await fetch(`/api/postgrest/member_profiles?${params}`);
  if (!response.ok) throw new Error("Failed to fetch community members");
  const json = await response.json();
  return json.data;
}

async function fetchMyProfile(): Promise<ProfileResponse> {
  return nestjsFetch<ProfileResponse>("profiles/me", "GET");
}

export function useCommunityMembers(filters: CommunityFilters = {}) {
  return useQuery({
    queryKey: ["community-members", filters],
    queryFn: () => fetchCommunityMembers(filters),
  });
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
