"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookstoreMembershipRole,
  BookstoreStatus,
  type AdminBookstoreDetail,
} from "@bookshare/shared";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MailCheck,
  Pencil,
  ShieldOff,
  XCircle,
} from "lucide-react";
import { useAdminFlow } from "@/flows/admin-flow-provider";
import {
  useAdminBookstore,
  useAdminResendBookstoreOwnerEmail,
  useAdminUpdateBookstoreStatus,
} from "@/domain/bookstores/queries";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

function formatUiDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
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

interface StatusAction {
  status: BookstoreStatus;
  label: string;
  icon: typeof CheckCircle2;
  variant: "default" | "outline";
  confirm: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmLabel?: string;
}

function getStatusActions(bookstore: AdminBookstoreDetail): StatusAction[] {
  switch (bookstore.status) {
    case BookstoreStatus.PENDING:
      return [
        {
          status: BookstoreStatus.APPROVED,
          label: "Approve",
          icon: CheckCircle2,
          variant: "default",
          confirm: false,
        },
        {
          status: BookstoreStatus.REJECTED,
          label: "Reject",
          icon: XCircle,
          variant: "outline",
          confirm: true,
          confirmTitle: "Reject this bookstore?",
          confirmDescription:
            "The application will be marked rejected. You can reconsider later by editing the review note.",
          confirmLabel: "Reject",
        },
      ];
    case BookstoreStatus.APPROVED:
      return [
        {
          status: BookstoreStatus.SUSPENDED,
          label: "Suspend",
          icon: ShieldOff,
          variant: "outline",
          confirm: true,
          confirmTitle: "Suspend this bookstore?",
          confirmDescription:
            "Suspending blocks the organization from accepting or creating new activity until re-approved.",
          confirmLabel: "Suspend",
        },
      ];
    case BookstoreStatus.SUSPENDED:
      return [
        {
          status: BookstoreStatus.APPROVED,
          label: "Re-approve",
          icon: CheckCircle2,
          variant: "default",
          confirm: false,
        },
      ];
    default:
      return [];
  }
}

interface DetailRowItem {
  label: string;
  value: string | null;
}

function DetailList({ items }: { items: DetailRowItem[] }) {
  return (
    <dl className="divide-y divide-border/60">
      {items.map((item) => (
        <div
          key={item.label}
          className="grid grid-cols-[140px_1fr] gap-3 py-3 text-sm"
        >
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="font-medium text-foreground">
            {item.value && item.value.length > 0 ? item.value : "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

export default function AdminBookstoreDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bookstoreId = params.id;

  const { openFlow } = useAdminFlow();
  const detailQuery = useAdminBookstore(bookstoreId);
  const updateStatus = useAdminUpdateBookstoreStatus(bookstoreId);
  const resendEmail = useAdminResendBookstoreOwnerEmail(bookstoreId);

  const [reviewNote, setReviewNote] = useState("");
  const [pendingStatus, setPendingStatus] = useState<StatusAction | null>(null);
  const [resendNotice, setResendNotice] = useState<
    { kind: "success" | "warning"; message: string } | null
  >(null);

  const bookstore = detailQuery.data ?? null;

  useEffect(() => {
    setReviewNote(bookstore?.reviewNote ?? "");
  }, [bookstore?.id, bookstore?.reviewNote]);

  const handleStatusChange = async (action: StatusAction) => {
    await updateStatus.mutateAsync({
      status: action.status,
      reviewNote,
    });
    setPendingStatus(null);
  };

  const handleResendEmail = async () => {
    setResendNotice(null);
    try {
      const result = await resendEmail.mutateAsync();
      setResendNotice(
        result.emailSent
          ? {
              kind: "success",
              message:
                "A new sign-in email with a recovery link was sent to the owner.",
            }
          : {
              kind: "warning",
              message:
                "SMTP is not configured, so no email was sent. Check server configuration before retrying.",
            }
      );
    } catch (error) {
      setResendNotice({
        kind: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Failed to resend the activation email.",
      });
    }
  };

  if (detailQuery.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading bookstore…
      </div>
    );
  }

  if (!bookstore) {
    return (
      <div className="space-y-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/bookstores")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to bookstores
        </Button>
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Bookstore not found.
        </div>
      </div>
    );
  }

  const statusActions = getStatusActions(bookstore);
  const canResendActivation =
    bookstore.ownerActivatedAt === null ||
    bookstore.status === BookstoreStatus.PENDING;

  return (
    <section className="space-y-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => router.push("/bookstores")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to bookstores
        </Button>
      </div>

      <header className="space-y-3 border-b border-border/70 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[2rem] font-semibold leading-[1.08] tracking-[-0.045em] text-foreground sm:text-[2.5rem]">
            {bookstore.name}
          </h1>
          <Badge variant={getStatusVariant(bookstore.status)}>
            {getStatusLabel(bookstore.status)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Created {formatUiDateTime(bookstore.createdAt)}
          {bookstore.reviewedAt
            ? ` · reviewed ${formatUiDateTime(bookstore.reviewedAt)}`
            : ""}
          {bookstore.ownerActivatedAt
            ? ` · owner activated ${formatUiDateTime(bookstore.ownerActivatedAt)}`
            : " · owner not yet activated"}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => openFlow({ kind: "edit-bookstore", bookstore })}
        >
          <Pencil className="h-4 w-4" />
          Edit details
        </Button>

        {canResendActivation ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={resendEmail.isPending}
            onClick={() => void handleResendEmail()}
          >
            {resendEmail.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MailCheck className="h-4 w-4" />
            )}
            Resend activation email
          </Button>
        ) : null}

        {statusActions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.status}
              type="button"
              variant={action.variant}
              size="sm"
              className="rounded-full"
              disabled={updateStatus.isPending}
              onClick={() => {
                if (action.confirm) {
                  setPendingStatus(action);
                } else {
                  void handleStatusChange(action);
                }
              }}
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </Button>
          );
        })}
      </div>

      {resendNotice ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            resendNotice.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {resendNotice.message}
        </div>
      ) : null}

      {updateStatus.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {updateStatus.error instanceof Error
            ? updateStatus.error.message
            : "Failed to update status."}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Public contact
          </h2>
          <div className="mt-3">
            <DetailList
              items={[
                { label: "Website", value: bookstore.websiteUrl },
                { label: "Phone", value: bookstore.phone },
                { label: "Email", value: bookstore.email },
                { label: "WhatsApp", value: bookstore.whatsapp },
                { label: "Instagram", value: bookstore.instagram },
                { label: "Address", value: bookstore.address },
              ]}
            />
          </div>
          {bookstore.contactNote ? (
            <div className="mt-5 rounded-xl border border-border/70 bg-background px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact note
              </p>
              <p className="mt-1 text-sm text-foreground">
                {bookstore.contactNote}
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Members" value={bookstore.memberCount} />
            <Metric label="Owners" value={bookstore.ownerCount} />
            <Metric
              label="Pending invites"
              value={bookstore.pendingInviteCount}
            />
            <Metric
              label="Proposals (30d)"
              value={bookstore.recentProposalCount}
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Review note
            </h2>
            <Textarea
              className="mt-3"
              rows={4}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="Optional review note (saved with the next status change)"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              The note is stored alongside the next Approve, Reject, Suspend,
              or Re-approve action.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Members
        </h2>
        {bookstore.members.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No members yet.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookstore.members.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell className="whitespace-normal">
                      <p className="font-medium">{member.displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.email || member.userId}
                      </p>
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
        )}
      </div>

      <ConfirmDialog
        open={pendingStatus !== null}
        title={pendingStatus?.confirmTitle ?? "Confirm action"}
        description={pendingStatus?.confirmDescription}
        confirmLabel={pendingStatus?.confirmLabel ?? "Confirm"}
        isLoading={updateStatus.isPending}
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => {
          if (pendingStatus) {
            void handleStatusChange(pendingStatus);
          }
        }}
      />
    </section>
  );
}
