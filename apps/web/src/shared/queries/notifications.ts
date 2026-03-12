"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MarkAllNotificationsReadResponse,
  NotificationListResponse,
  NotificationResponse,
  UnreadNotificationsCountResponse,
} from "@/shared/api";
import { nestjsFetch } from "./fetch";

interface NotificationsQueryOptions {
  limit?: number;
  offset?: number;
}

async function fetchNotifications(
  options: NotificationsQueryOptions
): Promise<NotificationListResponse> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  if (options.offset !== undefined) {
    params.set("offset", String(options.offset));
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return nestjsFetch<NotificationListResponse>(`notifications${suffix}`, "GET");
}

async function fetchUnreadNotificationsCount(): Promise<UnreadNotificationsCountResponse> {
  return nestjsFetch<UnreadNotificationsCountResponse>(
    "notifications/unread-count",
    "GET"
  );
}

export function useNotifications(
  options: NotificationsQueryOptions,
  queryOptions?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["notifications", options.limit ?? null, options.offset ?? null],
    queryFn: () => fetchNotifications(options),
    enabled: queryOptions?.enabled ?? true,
  });
}

export function useUnreadNotificationsCount(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: fetchUnreadNotificationsCount,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      nestjsFetch<NotificationResponse>(`notifications/${id}/read`, "PATCH"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      nestjsFetch<MarkAllNotificationsReadResponse>(
        "notifications/read-all",
        "PATCH"
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
}
