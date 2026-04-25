"use client";

import { useMemo, useState } from "react";
import { KeyRound, LogOut, Power, RotateCcw } from "lucide-react";
import { PlatformRole } from "@bookshare/shared";
import {
  type MemberDirectoryEntry,
  type MemberPasswordResetResult,
  useCreateMemberPasswordReset,
  useDeactivateMember,
  useMemberDirectory,
  useReactivateMember,
  useRevokeMemberSessions,
} from "@/domain/members/queries";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { PageIntro } from "@/shared/components/page-intro";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
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

type MembersSort = "name_asc" | "joined_desc" | "copies_desc" | "wishes_desc";
type MembersStatusFilter = "all" | "active" | "deactivated";
type PendingConfirmAction = "deactivate" | "revoke-sessions" | null;

interface ResetDelivery {
  member: MemberDirectoryEntry;
  result: MemberPasswordResetResult;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildResetDeliveryText(delivery: ResetDelivery) {
  const lines = [
    `BookShare password reset for ${delivery.member.email}`,
  ];

  if (delivery.result.recoveryCode) {
    lines.push(`Recovery code: ${delivery.result.recoveryCode}`);
  }
  if (delivery.result.recoveryLink) {
    lines.push(`Recovery page: ${delivery.result.recoveryLink}`);
  }
  if (delivery.result.expiresAt) {
    lines.push(`Expires: ${formatDateTime(delivery.result.expiresAt)}`);
  }

  return lines.join("\n");
}

async function copyToClipboard(value: string) {
  if (!navigator.clipboard) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function getMutationError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function MemberRowActions({
  actorUserId,
  canManageIdentities,
  member,
  onError,
  onNotice,
  onResetCreated,
}: {
  actorUserId: string | null;
  canManageIdentities: boolean;
  member: MemberDirectoryEntry;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onResetCreated: (delivery: ResetDelivery) => void;
}) {
  const resetPassword = useCreateMemberPasswordReset();
  const deactivateMember = useDeactivateMember();
  const reactivateMember = useReactivateMember();
  const revokeSessions = useRevokeMemberSessions();
  const [pendingConfirmAction, setPendingConfirmAction] =
    useState<PendingConfirmAction>(null);

  const isSelf = actorUserId === member.user_id;
  const isBusy =
    resetPassword.isPending ||
    deactivateMember.isPending ||
    reactivateMember.isPending ||
    revokeSessions.isPending;
  const canRunActions = canManageIdentities && !isSelf;

  const handleResetPassword = async () => {
    if (!canRunActions) return;

    try {
      const result = await resetPassword.mutateAsync(member.user_id);
      onResetCreated({ member, result });
    } catch (error) {
      onError(getMutationError(error, "Failed to create password reset code."));
    }
  };

  const handleReactivate = async () => {
    if (!canRunActions) return;

    try {
      await reactivateMember.mutateAsync(member.user_id);
      onNotice(`${member.displayName} has been reactivated.`);
    } catch (error) {
      onError(getMutationError(error, "Failed to reactivate member."));
    }
  };

  const handleConfirm = async () => {
    if (!canRunActions || !pendingConfirmAction) return;

    try {
      if (pendingConfirmAction === "deactivate") {
        await deactivateMember.mutateAsync(member.user_id);
        onNotice(`${member.displayName} has been deactivated.`);
      } else {
        await revokeSessions.mutateAsync(member.user_id);
        onNotice(`Active sessions for ${member.displayName} have been revoked.`);
      }
      setPendingConfirmAction(null);
    } catch (error) {
      onError(
        getMutationError(
          error,
          pendingConfirmAction === "deactivate"
            ? "Failed to deactivate member."
            : "Failed to revoke member sessions."
        )
      );
    }
  };

  if (!canManageIdentities) {
    return (
      <span className="text-xs text-muted-foreground">
        No identity actions
      </span>
    );
  }

  if (isSelf) {
    return (
      <span className="text-xs text-muted-foreground">
        Can't edit yourself
      </span>
    );
  }

  return (
    <>
      <div className="flex min-w-[260px] flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleResetPassword()}
          disabled={isBusy}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Reset password
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPendingConfirmAction("revoke-sessions")}
          disabled={isBusy}
        >
          <LogOut className="h-3.5 w-3.5" />
          Revoke sessions
        </Button>
        {member.status === "active" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
            onClick={() => setPendingConfirmAction("deactivate")}
            disabled={isBusy}
          >
            <Power className="h-3.5 w-3.5" />
            Deactivate
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleReactivate()}
            disabled={isBusy}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Activate
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={pendingConfirmAction !== null}
        title={
          pendingConfirmAction === "deactivate"
            ? "Deactivate this member?"
            : "Revoke this member's sessions?"
        }
        description={
          pendingConfirmAction === "deactivate"
            ? `${member.displayName} will be marked inactive in BookShare and Kratos. Their active sessions will also be revoked when possible.`
            : `${member.displayName} will be signed out of active Kratos sessions. They can sign in again if the account remains active.`
        }
        confirmLabel={
          pendingConfirmAction === "deactivate"
            ? "Deactivate"
            : "Revoke sessions"
        }
        isLoading={deactivateMember.isPending || revokeSessions.isPending}
        onCancel={() => setPendingConfirmAction(null)}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}

export function MembersWorkspace({
  actorRoles,
  actorUserId,
}: {
  actorRoles: string[];
  actorUserId: string | null;
}) {
  const membersQuery = useMemberDirectory();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<MembersSort>("name_asc");
  const [statusFilter, setStatusFilter] = useState<MembersStatusFilter>("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetDelivery, setResetDelivery] = useState<ResetDelivery | null>(null);
  const members = membersQuery.data ?? [];
  const canManageIdentities = actorRoles.includes(PlatformRole.PLATFORM_ADMIN);

  const filteredMembers = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return members
      .filter((member) => {
        if (statusFilter !== "all" && member.status !== statusFilter) {
          return false;
        }

        if (!normalized) {
          return true;
        }

        const haystacks = [
          member.displayName.toLowerCase(),
          member.email.toLowerCase(),
          member.location?.toLowerCase() ?? "",
        ];

        return haystacks.some((value) => value.includes(normalized));
      })
      .sort((left, right) => {
        switch (sortBy) {
          case "joined_desc":
            return right.created_at.localeCompare(left.created_at);
          case "copies_desc":
            return right.copyCount - left.copyCount || left.displayName.localeCompare(right.displayName);
          case "wishes_desc":
            return (
              right.activeWishCount - left.activeWishCount ||
              left.displayName.localeCompare(right.displayName)
            );
          case "name_asc":
          default:
            return left.displayName.localeCompare(right.displayName, undefined, {
              sensitivity: "base",
            });
        }
      });
  }, [members, search, sortBy, statusFilter]);

  const handleNotice = (message: string) => {
    setErrorMessage(null);
    setNotice(message);
  };

  const handleError = (message: string) => {
    setNotice(null);
    setErrorMessage(message);
  };

  const handleResetCreated = async (delivery: ResetDelivery) => {
    setErrorMessage(null);
    setResetDelivery(delivery);

    const copied = await copyToClipboard(buildResetDeliveryText(delivery));
    setNotice(
      copied
        ? `Password reset details for ${delivery.member.displayName} were copied.`
        : `Password reset details for ${delivery.member.displayName} were generated.`
    );
  };

  return (
    <section className="space-y-6">
      <PageIntro
        title="Members"
        description="Manage member accounts from a searchable directory. Identity actions are available to admins with the required platform permissions."
      />

      <div className="space-y-4">
        {notice ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {resetDelivery ? (
          <div className="rounded-2xl border border-border/75 bg-card px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">
                  Password reset details
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Share these details with {resetDelivery.member.displayName}
                  through an approved channel.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void copyToClipboard(buildResetDeliveryText(resetDelivery))
                }
              >
                Copy again
              </Button>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Code
                </p>
                <p className="mt-1 font-mono text-foreground">
                  {resetDelivery.result.recoveryCode ?? "—"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Recovery page
                </p>
                <p className="mt-1 break-all font-mono text-xs text-foreground">
                  {resetDelivery.result.recoveryLink ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Expires
                </p>
                <p className="mt-1 text-foreground">
                  {formatDateTime(resetDelivery.result.expiresAt)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members by name, email, or location"
          />
          <Select value={sortBy} onChange={(event) => setSortBy(event.target.value as MembersSort)}>
            <option value="name_asc">Sort: Name</option>
            <option value="joined_desc">Sort: Recently Joined</option>
            <option value="copies_desc">Sort: Most Copies</option>
            <option value="wishes_desc">Sort: Most Wishes</option>
          </Select>
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as MembersStatusFilter)}
          >
            <option value="all">Status: All</option>
            <option value="active">Status: Active</option>
            <option value="deactivated">Status: Deactivated</option>
          </Select>
        </div>

        {membersQuery.isError ? (
          <p className="text-sm text-red-700">
            {membersQuery.error instanceof Error
              ? membersQuery.error.message
              : "Failed to load members."}
          </p>
        ) : membersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading members...</p>
        ) : filteredMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No members match the current filters.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Copies</TableHead>
                <TableHead>Active Wishes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.user_id}>
                  <TableCell className="min-w-[200px] whitespace-normal">
                    <p className="font-medium text-foreground">{member.displayName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{member.email}</p>
                  </TableCell>
                  <TableCell>{member.location || "—"}</TableCell>
                  <TableCell>{member.copyCount}</TableCell>
                  <TableCell>{member.activeWishCount}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="border border-border/75 bg-background text-muted-foreground"
                    >
                      {member.status === "active" ? "Active" : "Deactivated"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(member.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <MemberRowActions
                      actorUserId={actorUserId}
                      canManageIdentities={canManageIdentities}
                      member={member}
                      onError={handleError}
                      onNotice={handleNotice}
                      onResetCreated={(delivery) =>
                        void handleResetCreated(delivery)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}
