"use client";

import { useQuery } from "@tanstack/react-query";
import type { PgMemberProfile } from "@/shared/api";
import { normalizeLocalMinioUrls } from "@/shared/lib/minio-url";

interface CommunityFilters {
  search?: string;
}

async function fetchCommunityMembers(
  filters: CommunityFilters
): Promise<PgMemberProfile[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "first_name.asc,last_name.asc,email.asc");

  if (filters.search) {
    params.set(
      "or",
      `(first_name.ilike.*${filters.search}*,last_name.ilike.*${filters.search}*,location.ilike.*${filters.search}*)`
    );
  }

  const response = await fetch(`/api/postgrest/member_profiles?${params}`);
  if (!response.ok) throw new Error("Failed to fetch community members");
  const json = await response.json();
  return normalizeLocalMinioUrls(json.data as PgMemberProfile[]);
}

export function useCommunityMembers(
  filters: CommunityFilters = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["community-members", filters],
    queryFn: () => fetchCommunityMembers(filters),
    enabled: options?.enabled ?? true,
  });
}
