"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { PaginationControls } from "@/shared/components/pagination-controls";
import {
  useMarkNotificationRead,
  useNotifications,
} from "@/shared/queries/notifications";

const pageSize = 20;

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const offset = (page - 1) * pageSize;

  const { data, isLoading } = useNotifications({ limit: pageSize, offset });
  const markNotificationRead = useMarkNotificationRead();

  const notifications = data?.items ?? [];
  const totalItems = data?.total ?? 0;
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalItems]);

  async function openNotification(notification: {
    id: string;
    read: boolean;
    linkTo: string | null;
  }) {
    if (!notification.read) {
      await markNotificationRead.mutateAsync(notification.id);
    }

    if (notification.linkTo) {
      router.push(notification.linkTo);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Updates about wishlist matches and other activity relevant to you.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>Inbox</CardTitle>
            <CardDescription>
              Newest first. Opening a notification marks it as read.
            </CardDescription>
          </div>
          <Badge variant={unreadCount > 0 ? "default" : "secondary"}>
            {unreadCount} unread on this page
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
              <Bell className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No notifications yet.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {notifications.map((notification) => {
                  const interactive =
                    !notification.read || !!notification.linkTo;

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => openNotification(notification)}
                      disabled={markNotificationRead.isPending}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        notification.read
                          ? "bg-card"
                          : "border-primary/40 bg-accent/30"
                      } ${interactive ? "hover:bg-accent/40" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{notification.title}</p>
                            {!notification.read && <Badge>Unread</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {notification.body}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(notification.createdAt)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <PaginationControls
                page={page}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
