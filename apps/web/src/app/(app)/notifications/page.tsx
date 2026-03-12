"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  NotificationType,
  type CopyAvailableNotificationMetadata,
  type NotificationBookSnapshot,
  type NotificationCopySnapshot,
  type NotificationEditionSnapshot,
  type NotificationMemberSnapshot,
  type NotificationWishSnapshot,
  type WishFulfilledImmediatelyNotificationMetadata,
  type WishMatchesCopyNotificationMetadata,
} from "@bookshare/shared";
import { Bell, Loader2 } from "lucide-react";
import type { NotificationResponse } from "@/shared/api";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { PaginationControls } from "@/shared/components/pagination-controls";
import {
  useMarkNotificationRead,
  useNotifications,
} from "@/shared/queries/notifications";

const pageSize = 20;

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function humanizeToken(value: string) {
  return value.replace(/_/g, " ");
}

function formatBookHeading(book: NotificationBookSnapshot) {
  return book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
}

function formatEditionSummary(edition: NotificationEditionSnapshot) {
  const parts = [humanizeToken(edition.format)];
  if (edition.isbn) parts.push(`ISBN ${edition.isbn}`);
  if (edition.publisher) parts.push(edition.publisher);
  if (edition.publishedYear) parts.push(String(edition.publishedYear));
  return parts.join(" · ");
}

function formatCopySummary(copy: NotificationCopySnapshot) {
  const parts = [humanizeToken(copy.condition)];
  if (copy.shareType) {
    parts.push(humanizeToken(copy.shareType));
  }
  return parts.join(" · ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isEditionSnapshot(value: unknown): value is NotificationEditionSnapshot {
  return (
    isRecord(value) &&
    typeof value.editionId === "string" &&
    isNullableString(value.isbn) &&
    typeof value.format === "string" &&
    isNullableString(value.publisher) &&
    (value.publishedYear === null || typeof value.publishedYear === "number")
  );
}

function isBookSnapshot(value: unknown): value is NotificationBookSnapshot {
  return (
    isRecord(value) &&
    typeof value.bookId === "string" &&
    typeof value.title === "string" &&
    isNullableString(value.subtitle) &&
    isStringArray(value.authors)
  );
}

function isMemberSnapshot(value: unknown): value is NotificationMemberSnapshot {
  return (
    isRecord(value) &&
    typeof value.userId === "string" &&
    isNullableString(value.username) &&
    typeof value.displayName === "string" &&
    isNullableString(value.firstName) &&
    isNullableString(value.cityArea) &&
    isNullableString(value.contactHandle) &&
    isNullableString(value.avatarUrl) &&
    isNullableString(value.profilePath)
  );
}

function isCopySnapshot(value: unknown): value is NotificationCopySnapshot {
  return (
    isRecord(value) &&
    typeof value.copyId === "string" &&
    typeof value.condition === "string" &&
    isNullableString(value.shareType) &&
    isNullableString(value.notes) &&
    isNullableString(value.contactNote) &&
    isEditionSnapshot(value.edition)
  );
}

function isWishSnapshot(value: unknown): value is NotificationWishSnapshot {
  return (
    isRecord(value) &&
    typeof value.wishId === "string" &&
    isNullableString(value.notes) &&
    (value.requestedEdition === null || isEditionSnapshot(value.requestedEdition))
  );
}

function isCopyAvailableMetadata(value: unknown): value is CopyAvailableNotificationMetadata {
  return (
    isRecord(value) &&
    isBookSnapshot(value.book) &&
    isWishSnapshot(value.wish) &&
    isCopySnapshot(value.copy) &&
    isMemberSnapshot(value.owner) &&
    typeof value.bookPath === "string"
  );
}

function isWishFulfilledImmediatelyMetadata(
  value: unknown
): value is WishFulfilledImmediatelyNotificationMetadata {
  return (
    isRecord(value) &&
    isBookSnapshot(value.book) &&
    isWishSnapshot(value.wish) &&
    Array.isArray(value.matches) &&
    value.matches.every(
      (entry) =>
        isRecord(entry) && isMemberSnapshot(entry.owner) && isCopySnapshot(entry.copy)
    ) &&
    typeof value.bookPath === "string"
  );
}

function isWishMatchesCopyMetadata(
  value: unknown
): value is WishMatchesCopyNotificationMetadata {
  return (
    isRecord(value) &&
    isBookSnapshot(value.book) &&
    isWishSnapshot(value.wish) &&
    isMemberSnapshot(value.wisher) &&
    Array.isArray(value.matchingCopies) &&
    value.matchingCopies.every((entry) => isCopySnapshot(entry)) &&
    typeof value.bookPath === "string"
  );
}

function DetailSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-background/70 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function DetailText({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span>{value}</span>
    </p>
  );
}

function LongText({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function BookSummary({ book }: { book: NotificationBookSnapshot }) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{formatBookHeading(book)}</p>
      <p className="text-sm text-muted-foreground">
        {book.authors.length > 0 ? book.authors.join(", ") : "Author not specified"}
      </p>
    </div>
  );
}

function MemberSummary({
  member,
  emptyContactLabel = "No public contact shared yet",
}: {
  member: NotificationMemberSnapshot;
  emptyContactLabel?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{member.displayName}</p>
      <p className="text-sm text-muted-foreground">
        {member.username ? `@${member.username}` : "Username not shared"}
      </p>
      <p className="text-sm text-muted-foreground">
        {member.cityArea || "Area not shared"}
      </p>
      <p className="text-sm">
        <span className="text-muted-foreground">Public contact: </span>
        <span>{member.contactHandle || emptyContactLabel}</span>
      </p>
    </div>
  );
}

function WishSummary({ wish }: { wish: NotificationWishSnapshot }) {
  return (
    <div className="space-y-2">
      {wish.requestedEdition ? (
        <DetailText
          label="Requested edition"
          value={formatEditionSummary(wish.requestedEdition)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No specific edition requested.
        </p>
      )}
      {wish.notes ? (
        <LongText label="Wish notes" value={wish.notes} />
      ) : (
        <p className="text-sm text-muted-foreground">No wish notes added.</p>
      )}
    </div>
  );
}

function CopySummary({ copy }: { copy: NotificationCopySnapshot }) {
  return (
    <div className="space-y-2 rounded-md border bg-card p-3">
      <div className="space-y-1">
        <p className="font-medium">{formatEditionSummary(copy.edition)}</p>
        <p className="text-sm text-muted-foreground">{formatCopySummary(copy)}</p>
      </div>
      {copy.notes ? <LongText label="Copy notes" value={copy.notes} /> : null}
      {copy.contactNote ? (
        <LongText label="Contact note" value={copy.contactNote} />
      ) : null}
    </div>
  );
}

function renderNotificationDetails(
  notification: {
    type: string;
    metadata: Record<string, unknown> | null;
  }
) {
  const metadata = notification.metadata;
  if (!metadata) return null;

  if (
    notification.type === NotificationType.COPY_AVAILABLE &&
    isCopyAvailableMetadata(metadata)
  ) {
    return (
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <DetailSection label="Book">
          <BookSummary book={metadata.book} />
          <DetailText label="Edition" value={formatEditionSummary(metadata.copy.edition)} />
        </DetailSection>
        <DetailSection label="Listed by">
          <MemberSummary member={metadata.owner} />
        </DetailSection>
        <DetailSection label="Copy details">
          <CopySummary copy={metadata.copy} />
        </DetailSection>
        <DetailSection label="Your wish">
          <WishSummary wish={metadata.wish} />
        </DetailSection>
      </div>
    );
  }

  if (
    notification.type === NotificationType.WISH_FULFILLED_IMMEDIATELY &&
    isWishFulfilledImmediatelyMetadata(metadata)
  ) {
    return (
      <div className="mt-4 space-y-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <DetailSection label="Book">
            <BookSummary book={metadata.book} />
          </DetailSection>
          <DetailSection label="Your request">
            <WishSummary wish={metadata.wish} />
          </DetailSection>
        </div>
        <DetailSection
          label={
            metadata.matches.length === 1 ? "Matching copy" : "Matching copies"
          }
        >
          <div className="space-y-3">
            {metadata.matches.map((match) => (
              <div
                key={match.copy.copyId}
                className="space-y-3 rounded-md border bg-card p-3"
              >
                <MemberSummary member={match.owner} />
                <CopySummary copy={match.copy} />
              </div>
            ))}
          </div>
        </DetailSection>
      </div>
    );
  }

  if (
    notification.type === NotificationType.WISH_MATCHES_COPY &&
    isWishMatchesCopyMetadata(metadata)
  ) {
    return (
      <div className="mt-4 space-y-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <DetailSection label="Book">
            <BookSummary book={metadata.book} />
            {metadata.wish.requestedEdition ? (
              <DetailText
                label="Requested edition"
                value={formatEditionSummary(metadata.wish.requestedEdition)}
              />
            ) : null}
          </DetailSection>
          <DetailSection label="Reader looking for this book">
            <MemberSummary member={metadata.wisher} />
            {metadata.wish.notes ? (
              <LongText label="Wish notes" value={metadata.wish.notes} />
            ) : (
              <p className="text-sm text-muted-foreground">No wish notes added.</p>
            )}
          </DetailSection>
        </div>
        <DetailSection
          label={
            metadata.matchingCopies.length === 1
              ? "Your matching copy"
              : "Your matching copies"
          }
        >
          <div className="space-y-3">
            {metadata.matchingCopies.map((copy) => (
              <CopySummary key={copy.copyId} copy={copy} />
            ))}
          </div>
        </DetailSection>
      </div>
    );
  }

  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationResponse | null>(null);
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

  async function ensureNotificationRead(notification: NotificationResponse) {
    if (!notification.read) {
      await markNotificationRead.mutateAsync(notification.id);
    }
  }

  async function openNotification(notification: NotificationResponse) {
    await ensureNotificationRead(notification);
    if (notification.linkTo) {
      router.push(notification.linkTo);
    }
  }

  async function openNotificationDetails(notification: NotificationResponse) {
    await ensureNotificationRead(notification);
    setSelectedNotification({
      ...notification,
      read: true,
    });
  }

  const selectedNotificationDetails = selectedNotification
    ? renderNotificationDetails(selectedNotification)
    : null;

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
              Newest first. Open the full details only when you need more context.
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
                  const details = renderNotificationDetails(notification);
                  const canViewDetails = !!details;
                  const canOpen = !!notification.linkTo;

                  return (
                    <div
                      key={notification.id}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        notification.read
                          ? "bg-card"
                          : "border-primary/40 bg-accent/30"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{notification.title}</p>
                            {!notification.read && <Badge>Unread</Badge>}
                          </div>
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {notification.body}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(notification.createdAt)}
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {canViewDetails ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => openNotificationDetails(notification)}
                            disabled={markNotificationRead.isPending}
                          >
                            View details
                          </Button>
                        ) : null}
                        {canOpen ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openNotification(notification)}
                            disabled={markNotificationRead.isPending}
                          >
                            Open related page
                          </Button>
                        ) : null}
                      </div>
                    </div>
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

      <Dialog
        open={!!selectedNotification}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNotification(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedNotification?.title ?? "Notification details"}</DialogTitle>
            <DialogDescription>
              {selectedNotification
                ? `${selectedNotification.body} • ${formatTimestamp(
                    selectedNotification.createdAt
                  )}`
                : "Additional context for this notification."}
            </DialogDescription>
          </DialogHeader>
          {selectedNotificationDetails ?? (
            <p className="text-sm text-muted-foreground">
              No additional details are available for this notification.
            </p>
          )}
          {selectedNotification?.linkTo ? (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  const linkTo = selectedNotification.linkTo;
                  if (!linkTo) return;
                  setSelectedNotification(null);
                  router.push(linkTo);
                }}
              >
                Open related page
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
