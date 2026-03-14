"use client";

import Link from "next/link";
import type { PgCopyDetail } from "@/shared/api";
import { useBookDetail, useEditionsByBook } from "@/shared/queries/books";
import {
  useMyCopyDetail,
  type MyCopyDialogDetail,
} from "@/shared/queries/my-library";
import { BookDialogHero } from "@/shared/components/book-dialog-hero";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/shared/components/ui/dialog";

const statusLabels: Record<string, string> = {
  available: "Available",
  shelved: "Shelved",
  lent: "Lent",
  gone: "Gone",
};

const shareTypeLabels: Record<string, string> = {
  lend: "Lend",
  sell: "Sell",
  give_away: "Give Away",
};

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

const conditionLabels: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

const eventLabels: Record<string, string> = {
  listed: "Added",
  status_changed: "Status changed",
  condition_changed: "Condition changed",
  lent: "Lent",
  returned: "Returned",
  sold: "Sold",
  donated: "Donated",
  given_away: "Given away",
  lost: "Lost",
  damaged: "Damaged",
  note_added: "Note added",
};

const recipientEventTypes = new Set(["lent", "sold", "donated", "given_away"]);

interface CounterpartyDisplay {
  type: "member" | "external";
  name: string;
  location: string | null;
  contactNotes: string | null;
  contact: string | null;
}

interface EventDetailLine {
  label: string;
  value: string;
}

function formatTimelineDate(value: string) {
  const date = new Date(value);
  return {
    day: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function getMetadataRecord(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getCounterpartyDisplay(
  metadata: Record<string, unknown> | null | undefined,
  key: "counterparty" | "closedLoanCounterparty"
): CounterpartyDisplay | null {
  const snapshot = getMetadataRecord(metadata, key);

  if (snapshot) {
    const type =
      snapshot.type === "member" || snapshot.type === "external"
        ? snapshot.type
        : null;
    const name =
      typeof snapshot.name === "string" && snapshot.name.trim().length > 0
        ? snapshot.name
        : null;

    if (type && name) {
      return {
        type,
        name,
        location:
          typeof snapshot.location === "string" ? snapshot.location : null,
        contactNotes:
          typeof snapshot.contactNotes === "string"
            ? snapshot.contactNotes
            : null,
        contact:
          typeof snapshot.contact === "string" ? snapshot.contact : null,
      };
    }
  }

  if (key === "counterparty") {
    const externalCounterpartyName = getMetadataString(
      metadata,
      "externalCounterpartyName"
    );
    if (externalCounterpartyName) {
      return {
        type: "external",
        name: externalCounterpartyName,
        location: null,
        contactNotes: null,
        contact: getMetadataString(metadata, "externalCounterpartyContact"),
      };
    }

    if (getMetadataString(metadata, "counterpartyType") === "member") {
      return {
        type: "member",
        name: "Community member",
        location: null,
        contactNotes: null,
        contact: null,
      };
    }
  }

  return null;
}

function getEventContext(event: MyCopyDialogDetail["events"][number]) {
  const metadata = event.metadata;
  const counterparty = getCounterpartyDisplay(metadata, "counterparty");
  const previousCounterparty = getCounterpartyDisplay(
    metadata,
    "closedLoanCounterparty"
  );

  if (event.eventType === "returned" && previousCounterparty) {
    return `from ${previousCounterparty.name}`;
  }

  if (counterparty) {
    return `${recipientEventTypes.has(event.eventType) ? "to" : "with"} ${
      counterparty.name
    }`;
  }

  if (event.eventType === "status_changed" && event.fromStatus && event.toStatus) {
    return `${statusLabels[event.fromStatus] ?? event.fromStatus} to ${
      statusLabels[event.toStatus] ?? event.toStatus
    }`;
  }

  if (event.eventType === "lost" && previousCounterparty) {
    return `last recorded with ${previousCounterparty.name}`;
  }

  return null;
}

function pushCounterpartyLines(
  lines: EventDetailLine[],
  label: string,
  counterparty: CounterpartyDisplay
) {
  const primaryValue =
    counterparty.type === "member" && counterparty.location
      ? `${counterparty.name} · ${counterparty.location}`
      : counterparty.name;

  lines.push({
    label,
    value: primaryValue,
  });

  if (counterparty.type === "member" && counterparty.contactNotes) {
    lines.push({
      label: "Member contact notes",
      value: counterparty.contactNotes,
    });
  }

  if (counterparty.type === "external" && counterparty.contact) {
    lines.push({
      label: "External contact",
      value: counterparty.contact,
    });
  }
}

function getEventDetailLines(event: MyCopyDialogDetail["events"][number]) {
  const metadata = event.metadata;
  const lines: EventDetailLine[] = [];
  const counterparty = getCounterpartyDisplay(metadata, "counterparty");
  const previousCounterparty = getCounterpartyDisplay(
    metadata,
    "closedLoanCounterparty"
  );
  const autoClosedWish = getMetadataRecord(metadata, "autoClosedWish");

  if (counterparty) {
    pushCounterpartyLines(
      lines,
      event.eventType === "lent" ? "Borrower" : "Recipient",
      counterparty
    );
  }

  if (previousCounterparty) {
    pushCounterpartyLines(
      lines,
      event.eventType === "returned" ? "Returned from" : "Previous borrower",
      previousCounterparty
    );
  }

  if (autoClosedWish) {
    lines.push({
      label: "Wishlist",
      value: "Matching community wish closed automatically",
    });
  }

  return lines;
}

function shouldHideEventNote(event: MyCopyDialogDetail["events"][number]) {
  const note = event.notes?.trim();
  if (!note) return true;

  if (event.eventType === "listed") {
    if (note === "Copy added to library") return true;
    if (/^Imported via run\b/i.test(note)) return true;
  }

  return false;
}

interface LibraryCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: PgCopyDetail | null;
}

export function LibraryCopyDialog({
  open,
  onOpenChange,
  copy,
}: LibraryCopyDialogProps) {
  const copyId = copy?.id ?? null;
  const { data: copyDetail, isLoading } = useMyCopyDetail(copyId);

  const bookId =
    copyDetail?.edition?.book?.id ?? copy?.edition?.book?.id ?? "";
  const { data: book } = useBookDetail(bookId);
  const { data: editions } = useEditionsByBook(bookId);

  const title =
    copyDetail?.edition?.book?.title ?? copy?.edition?.book?.title ?? "Copy";
  const subtitle =
    copyDetail?.edition?.book?.subtitle ?? copy?.edition?.book?.subtitle ?? null;
  const authors = book?.authors?.map((author) => author.name).join(", ") ?? null;
  const imageUrl =
    copyDetail?.edition?.coverImageUrl ??
    copy?.edition?.cover_image_url ??
    (copyDetail?.edition?.id
      ? editions?.find((edition) => edition.id === copyDetail.edition?.id)?.cover_image_url
      : null) ??
    (copy?.edition?.id
      ? editions?.find((edition) => edition.id === copy.edition.id)?.cover_image_url
      : null) ??
    editions?.find((edition) => edition.cover_image_url)?.cover_image_url ??
    null;
  const format =
    copyDetail?.edition?.format ?? copy?.edition?.format ?? null;
  const isbn = copyDetail?.edition?.isbn ?? copy?.edition?.isbn ?? null;
  const publisher =
    copyDetail?.edition?.publisher ?? copy?.edition?.publisher ?? null;
  const publishedYear =
    copyDetail?.edition?.publishedYear ?? copy?.edition?.published_year ?? null;
  const pageCount =
    copyDetail?.edition?.pageCount ?? copy?.edition?.page_count ?? null;
  const status = copyDetail?.status ?? copy?.status ?? null;
  const shareType = copyDetail?.shareType ?? copy?.share_type ?? null;
  const condition = copyDetail?.condition ?? copy?.condition ?? null;
  const notes = copyDetail?.notes ?? copy?.notes ?? null;
  const contactNote = copyDetail?.contactNote ?? copy?.contact_note ?? null;
  const lastConfirmedAt =
    copyDetail?.lastConfirmedAt ?? copy?.last_confirmed_at ?? null;
  const createdAt = copyDetail?.createdAt ?? copy?.created_at ?? null;
  const events = copyDetail?.events ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {!copy ? (
          <p className="text-sm text-muted-foreground">
            Select a copy to view details.
          </p>
        ) : (
          <>
            <BookDialogHero
              title={title}
              subtitle={subtitle}
              authors={authors}
              imageUrl={imageUrl}
            />

            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Your copy
              </p>
              <div className="flex flex-wrap gap-1.5">
                {status ? (
                  <Badge variant={status === "available" ? "default" : "secondary"}>
                    {statusLabels[status] ?? status}
                  </Badge>
                ) : null}
                {shareType ? (
                  <Badge variant="outline">
                    {shareTypeLabels[shareType] ?? shareType}
                  </Badge>
                ) : null}
                {condition ? (
                  <Badge variant="secondary">
                    {conditionLabels[condition] ?? condition}
                  </Badge>
                ) : null}
                {format ? (
                  <Badge variant="outline">
                    {formatLabels[format] ?? format}
                  </Badge>
                ) : null}
                {isbn ? <Badge variant="outline">ISBN: {isbn}</Badge> : null}
              </div>
              {publisher ? (
                <p className="text-sm text-muted-foreground">
                  Publisher: {publisher}
                  {publishedYear ? ` • ${publishedYear}` : ""}
                  {pageCount ? ` • ${pageCount} pages` : ""}
                </p>
              ) : null}
              {createdAt ? (
                <p className="text-sm text-muted-foreground">
                  Added {new Date(createdAt).toLocaleDateString()}
                </p>
              ) : null}
              {lastConfirmedAt ? (
                <p className="text-sm text-muted-foreground">
                  Last confirmed {new Date(lastConfirmedAt).toLocaleDateString()}
                </p>
              ) : null}
              {notes ? (
                <p className="text-sm">
                  <span className="font-medium">Notes:</span> {notes}
                </p>
              ) : null}
              {contactNote ? (
                <p className="text-sm">
                  <span className="font-medium">Contact note:</span> {contactNote}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Timeline</h3>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-16 animate-pulse rounded border bg-muted"
                    />
                  ))}
                </div>
              ) : events.length > 0 ? (
                <div className="px-1 sm:px-2">
                  {events.map((event, index) => {
                    const context = getEventContext(event);
                    const detailLines = getEventDetailLines(event);
                    const formatted = formatTimelineDate(event.createdAt);
                    const isLast = index === events.length - 1;
                    return (
                      <div
                        key={event.id}
                        className="grid grid-cols-[60px_20px_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[76px_24px_minmax(0,1fr)]"
                      >
                        <div className="pt-0.5 text-right text-[11px] leading-tight text-muted-foreground">
                          <p>{formatted.day}</p>
                          <p>{formatted.time}</p>
                        </div>

                        <div className="relative flex justify-center">
                          {!isLast ? (
                            <span className="absolute bottom-[-16px] top-4 w-px bg-border" />
                          ) : null}
                          <span className="mt-1 h-3 w-3 rounded-full border-2 border-border bg-background" />
                        </div>

                        <div className="min-w-0 pt-0.5">
                          <p className="text-sm font-medium">
                            {eventLabels[event.eventType] ?? event.eventType}
                          </p>
                          {context ? (
                            <p className="text-sm text-muted-foreground">{context}</p>
                          ) : null}
                          {detailLines.length > 0 ? (
                            <div className="mt-1 space-y-1">
                              {detailLines.map((line) => (
                                <p
                                  key={`${event.id}-${line.label}-${line.value}`}
                                  className="text-xs text-muted-foreground"
                                >
                                  <span className="font-medium text-foreground/80">
                                    {line.label}:
                                  </span>{" "}
                                  {line.value}
                                </p>
                              ))}
                            </div>
                          ) : null}
                          {!shouldHideEventNote(event) ? (
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                              {event.notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No copy history recorded yet.
                </p>
              )}
            </div>

            <DialogFooter>
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline" className="sm:flex-1">
                  <Link href={`/books/${bookId}`}>View Book Details</Link>
                </Button>
                <Button asChild className="sm:flex-1">
                  <Link href={`/my-library/${copy.id}/edit`}>Edit Copy</Link>
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
