"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface ProfileResponse {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error("Profile request failed.");
  }

  return (await response.json()) as T;
}

export function useMyProfile(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["admin-my-profile"],
    queryFn: () => requestJson<ProfileResponse>("/api/nestjs/profiles/me"),
    enabled: options?.enabled ?? true,
  });
}

export function useSyncMyProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      requestJson<ProfileResponse>("/api/nestjs/profiles/sync", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-my-profile"] });
    },
  });
}
