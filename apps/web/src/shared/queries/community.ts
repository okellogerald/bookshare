"use client";

import { useQuery } from "@tanstack/react-query";
import type { PgMemberProfile } from "@/shared/api";
import { isVisibleCommunityUsername } from "@/shared/lib/member-visibility";

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
      `(username.ilike.*${filters.search}*,first_name.ilike.*${filters.search}*,last_name.ilike.*${filters.search}*,city_area.ilike.*${filters.search}*)`
    );
  }

  const response = await fetch(`/api/postgrest/member_profiles?${params}`);
  if (!response.ok) throw new Error("Failed to fetch community members");
  const json = await response.json();
  const members = json.data as PgMemberProfile[];
  return members.filter((member) => isVisibleCommunityUsername(member.username));
}

export function useCommunityMembers(filters: CommunityFilters = {}) {
  return useQuery({
    queryKey: ["community-members", filters],
    queryFn: () => fetchCommunityMembers(filters),
  });
}
