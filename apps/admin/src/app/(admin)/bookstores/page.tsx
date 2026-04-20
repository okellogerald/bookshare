"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookstoreMembershipRole,
  BookstoreStatus,
  type AdminBookstoreDetail,
} from "@bookshare/shared";
import { Loader2, Plus } from "lucide-react";
import { useAdminFlow } from "@/flows/admin-flow-provider";
import {
  useAdminBookstore,
  useAdminBookstores,
  useAdminUpdateBookstoreStatus,
} from "@/domain/bookstores/queries";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Textarea } from "@/shared/components/ui/textarea";

function formatUiDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getStatusLabel(status: BookstoreStatus) {
  switch (status) {
    case BookstoreStatus.PENDING:
      return "Pending review";
    case BookstoreStatus.APPROVED:
      return "Approved";
    case BookstoreStatus.REJECTED:
      return "Rejected";
    case BookstoreStatus.SUSPENDED:
      return "Suspended";
    default:
      return status;
  }
}

function getStatusVariant(status: BookstoreStatus) {
  switch (status) {
    case BookstoreStatus.APPROVED:
      return "default" as const;
    case BookstoreStatus.PENDING:
      return "secondary" as const;
    case BookstoreStatus.REJECTED:
    case BookstoreStatus.SUSPENDED:
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

function getAvailableActions(bookstore: AdminBookstoreDetail) {
  switch (bookstore.status) {
    case BookstoreStatus.PENDING:
      return [
        { label: "Approve", status: BookstoreStatus.APPROVED },
        { label: "Reject", status: BookstoreStatus.REJECTED },
      ];
    case BookstoreStatus.APPROVED:
      return [{ label: "Suspend", status: BookstoreStatus.SUSPENDED }];
    case BookstoreStatus.SUSPENDED:
      return [{ label: "Re-approve", status: BookstoreStatus.APPROVED }];
    default:
      return [];
  }
}

export default function AdminBookstoresPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [status, setStatus] = useState<"all" | BookstoreStatus>(
    (searchParams.get("status") as "all" | BookstoreStatus | null) ?? "all"
  );
  const [reviewNote, setReviewNote] = useState("");
  const { openFlow } = useAdminFlow();
  const selectedBookstoreId = searchParams.get("id");

  const bookstoresQuery = useAdminBookstores({
    status,
    query,
  });
  const bookstoreDetailQuery = useAdminBookstore(selectedBookstoreId);
  const updateStatus = useAdminUpdateBookstoreStatus(selectedBookstoreId ?? "");

  useEffect(() => {
    if (!selectedBookstoreId && bookstoresQuery.data && bookstoresQuery.data.length > 0) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("id", bookstoresQuery.data[0].id);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [bookstoresQuery.data, pathname, router, searchParams, selectedBookstoreId]);

  useEffect(() => {
    setReviewNote(bookstoreDetailQuery.data?.reviewNote ?? "");
  }, [bookstoreDetailQuery.data?.id, bookstoreDetailQuery.data?.reviewNote]);

  function updateSearchParams(next: {
    id?: string | null;
    query?: string;
    status?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.id === null) {
      params.delete("id");
    } else if (next.id !== undefined) {
      params.set("id", next.id);
    }

    if (next.query !== undefined) {
      if (next.query.trim()) {
        params.set("query", next.query.trim());
      } else {
        params.delete("query");
      }
    }

    if (next.status !== undefined) {
      if (next.status && next.status !== "all") {
        params.set("status", next.status);
      } else {
        params.delete("status");
      }
    }

    const serialized = params.toString();
    router.replace(serialized ? `${pathname}?${serialized}` : pathname);
  }

  const selectedBookstore = bookstoreDetailQuery.data ?? null;
  const errorMessage = useMemo(() => {
    return (
      (bookstoresQuery.error as Error | null)?.message ||
      (bookstoreDetailQuery.error as Error | null)?.message ||
      (updateStatus.error as Error | null)?.message ||
      null
    );
  }, [bookstoreDetailQuery.error, bookstoresQuery.error, updateStatus.error]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Bookstores</h1>
          <p className="text-muted-foreground">
            Review bookstores, inspect owners and contacts, and control approval status.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-full px-4"
          onClick={() => openFlow({ kind: "create-bookstore" })}
        >
          <Plus className="h-4 w-4" />
          Create bookstore
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Directory</CardTitle>
            <CardDescription>
              Filter by status or search contact information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <Input
                value={query}
                onChange={(event) => {
                  const next = event.target.value;
                  setQuery(next);
                  updateSearchParams({ query: next });
                }}
                placeholder="Search name, email, phone, Instagram, or website"
              />
              <Select
                value={status}
                onChange={(event) => {
                  const next = event.target.value as "all" | BookstoreStatus;
                  setStatus(next);
                  updateSearchParams({ status: next });
                }}
              >
                <option value="all">All statuses</option>
                <option value={BookstoreStatus.PENDING}>Pending</option>
                <option value={BookstoreStatus.APPROVED}>Approved</option>
                <option value={BookstoreStatus.REJECTED}>Rejected</option>
                <option value={BookstoreStatus.SUSPENDED}>Suspended</option>
              </Select>
            </div>

            {bookstoresQuery.isLoading ? (
              <div className="flex h-48 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Loading bookstores…
              </div>
            ) : bookstoresQuery.data?.length ? (
              <div className="space-y-3">
                {bookstoresQuery.data.map((bookstore) => {
                  const isSelected = selectedBookstoreId === bookstore.id;

                  return (
                    <button
                      key={bookstore.id}
                      type="button"
                      onClick={() => updateSearchParams({ id: bookstore.id })}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-primary/35 bg-muted"
                          : "border-border bg-background hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{bookstore.name}</p>
                        <Badge variant={getStatusVariant(bookstore.status)}>
                          {getStatusLabel(bookstore.status)}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>{bookstore.memberCount} members</span>
                        <span>{bookstore.ownerCount} owners</span>
                        <span>{bookstore.recentProposalCount} proposals (30d)</span>
                      </div>
                      {bookstore.ownerNames.length > 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Owners: {bookstore.ownerNames.join(", ")}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                No bookstores match this view.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          {selectedBookstoreId === null ? (
            <CardContent className="flex h-full min-h-[32rem] items-center justify-center text-sm text-muted-foreground">
              Select a bookstore to review it.
            </CardContent>
          ) : bookstoreDetailQuery.isLoading ? (
            <CardContent className="flex h-full min-h-[32rem] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Loading bookstore detail…
            </CardContent>
          ) : !selectedBookstore ? (
            <CardContent className="flex h-full min-h-[32rem] items-center justify-center text-sm text-muted-foreground">
              Bookstore detail unavailable.
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{selectedBookstore.name}</CardTitle>
                  <Badge variant={getStatusVariant(selectedBookstore.status)}>
                    {getStatusLabel(selectedBookstore.status)}
                  </Badge>
                </div>
                <CardDescription>
                  Created {formatUiDateTime(selectedBookstore.createdAt)}
                  {selectedBookstore.reviewedAt
                    ? ` • reviewed ${formatUiDateTime(selectedBookstore.reviewedAt)}`
                    : ""}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border bg-background px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Public contact
                    </p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>{selectedBookstore.websiteUrl || "No website"}</p>
                      <p>{selectedBookstore.phone || "No phone"}</p>
                      <p>{selectedBookstore.email || "No email"}</p>
                      <p>{selectedBookstore.whatsapp || "No WhatsApp"}</p>
                      <p>{selectedBookstore.instagram || "No Instagram"}</p>
                      <p>{selectedBookstore.address || "No address"}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Summary
                    </p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>{selectedBookstore.memberCount} members</p>
                      <p>{selectedBookstore.ownerCount} owners</p>
                      <p>{selectedBookstore.pendingInviteCount} pending invites</p>
                      <p>{selectedBookstore.recentProposalCount} proposals in 30 days</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contact note
                  </p>
                  <div className="rounded-xl border bg-background px-4 py-3 text-sm">
                    {selectedBookstore.contactNote || "No contact note provided."}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Review actions
                  </p>
                  <Textarea
                    rows={4}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Optional review note"
                  />
                  <div className="flex flex-wrap gap-2">
                    {getAvailableActions(selectedBookstore).map((action) => (
                      <Button
                        key={action.status}
                        type="button"
                        variant={action.status === BookstoreStatus.REJECTED ? "outline" : "default"}
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({
                            status: action.status,
                            reviewNote,
                          })
                        }
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Members
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBookstore.members.map((member) => (
                        <TableRow key={member.userId}>
                          <TableCell className="whitespace-normal">
                            <div className="space-y-1">
                              <p className="font-medium">{member.displayName}</p>
                              <p className="text-sm text-muted-foreground">
                                {member.email || member.userId}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                member.role === BookstoreMembershipRole.OWNER
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {member.role === BookstoreMembershipRole.OWNER
                                ? "Owner"
                                : "Member"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatUiDateTime(member.joinedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
