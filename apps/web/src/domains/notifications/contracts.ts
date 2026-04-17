import { initContract } from "@ts-rest/core";

const c = initContract();

// ─── Notifications ───────────────────────────────────────────

export interface NotificationResponse {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read: boolean;
  linkTo: string | null;
  createdAt: string;
}

export interface NotificationListQuery {
  limit?: number;
  offset?: number;
}

export interface NotificationListResponse {
  items: NotificationResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface UnreadNotificationsCountResponse {
  count: number;
}

export interface MarkAllNotificationsReadResponse {
  updated: number;
}

export const notificationsContract = c.router({
  list: {
    method: "GET",
    path: "/api/nestjs/notifications",
    query: c.type<NotificationListQuery>(),
    responses: { 200: c.type<NotificationListResponse>() },
  },
  unreadCount: {
    method: "GET",
    path: "/api/nestjs/notifications/unread-count",
    responses: { 200: c.type<UnreadNotificationsCountResponse>() },
  },
  markRead: {
    method: "PATCH",
    path: "/api/nestjs/notifications/:id/read",
    body: null,
    responses: { 200: c.type<NotificationResponse>() },
  },
  markAllRead: {
    method: "PATCH",
    path: "/api/nestjs/notifications/read-all",
    body: null,
    responses: { 200: c.type<MarkAllNotificationsReadResponse>() },
  },
});
