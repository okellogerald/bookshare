"use client";

import { type FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  BookstoreMembershipRole,
  BookstoreMembershipStatus,
  BookstoreStatus,
  type BookstoreMemberRecord,
} from "@bookshare/shared";
import {
  useBookstore,
  useBookstoreMembers,
  useBookstoresMe,
  useCreateOrganizationInvite,
  useRemoveOrganizationMember,
  useRevokeOrganizationInvite,
  useUpdateOrganizationMemberRole,
} from "@/domain/bookstores/queries";
import { BookstoreStatusBanner } from "@/shared/components/bookstore-status";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { getMembershipRoleLabel } from "@/shared/lib/bookstores";
import { formatUiDateTime } from "@/shared/lib/date";
import { cn } from "@/shared/lib/utils";
import { PermissionsDialog } from "./_components/permissions-dialog";

type MembersTab = "members" | "invites";

type PendingAccessAction =
  | { kind: "demote"; userId: string; label: string }
  | { kind: "remove"; userId: string; label: string }
  | { kind: "revokeInvite"; inviteId: string; label: string };

type PermissionsTarget = {
  userId: string;
  label: string;
  extraPermissions: string[];
};

function getActionDialogCopy(action: PendingAccessAction | null) {
  switch (action?.kind) {
    case "demote":
      return {
        title: "Demote owner?",
        description: `${action.label} will lose owner access and can no longer manage bookstore details or members.`,
        confirmLabel: "Demote owner",
      };
    case "remove":
      return {
        title: "Remove member?",
        description: `${action.label} will lose access to this bookstore workspace.`,
        confirmLabel: "Remove member",
      };
    case "revokeInvite":
      return {
        title: "Revoke invite?",
        description: `The invite for ${action.label} will no longer be usable.`,
        confirmLabel: "Revoke invite",
      };
    default:
      return {
        title: "Confirm action",
        description: "Confirm this access change.",
        confirmLabel: "Confirm",
      };
  }
}

function getMemberLabel(member: BookstoreMemberRecord) {
  return member.displayName || member.email || member.userId;
}

function getMemberInitials(member: BookstoreMemberRecord) {
  const source = member.displayName || member.email || member.userId;
  const parts = source
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function BookstoreMembersPage() {
  const params = useParams<{ bookstoreId: string }>();
  const bookstoreId = params.bookstoreId;
  const [activeTab, setActiveTab] = useState<MembersTab>("members");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [pendingAction, setPendingAction] =
    useState<PendingAccessAction | null>(null);
  const [permissionsTarget, setPermissionsTarget] =
    useState<PermissionsTarget | null>(null);

  const meQuery = useBookstoresMe();
  const currentUserId = meQuery.data?.user.id ?? null;
  const bookstoreQuery = useBookstore(bookstoreId);
  const bookstore = bookstoreQuery.data;
  const membersQuery = useBookstoreMembers(bookstoreId, {
    enabled: bookstore?.canManageMembers === true,
  });
  const createInvite = useCreateOrganizationInvite(bookstoreId);
  const revokeInvite = useRevokeOrganizationInvite(bookstoreId);
  const updateRole = useUpdateOrganizationMemberRole(bookstoreId);
  const removeMember = useRemoveOrganizationMember(bookstoreId);

  if (bookstoreQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading bookstore…
      </div>
    );
  }

  if (bookstoreQuery.error || !bookstore) {
    return (
      <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {(bookstoreQuery.error as Error | null)?.message || "Bookstore not found."}
      </div>
    );
  }

  if (!bookstore.canManageMembers) {
    return (
      <div className="space-y-4">
        <BookstoreStatusBanner status={bookstore.status} reviewNote={bookstore.reviewNote} />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Only bookstore owners can manage members and invites.
          </CardContent>
        </Card>
      </div>
    );
  }

  const members = membersQuery.data?.members ?? [];
  const pendingInvites = membersQuery.data?.pendingInvites ?? [];
  const actionCopy = getActionDialogCopy(pendingAction);
  const actionPending =
    removeMember.isPending || updateRole.isPending || revokeInvite.isPending;

  const errorMessage =
    (membersQuery.error as Error | null)?.message ||
    (createInvite.error as Error | null)?.message ||
    (revokeInvite.error as Error | null)?.message ||
    (updateRole.error as Error | null)?.message ||
    (removeMember.error as Error | null)?.message ||
    null;

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createInvite.mutateAsync({ email: inviteEmail });
    setInviteEmail("");
    setInviteOpen(false);
    setActiveTab("invites");
  }

  async function handleConfirmAction() {
    if (!pendingAction) return;

    switch (pendingAction.kind) {
      case "demote":
        await updateRole.mutateAsync({
          userId: pendingAction.userId,
          role: BookstoreMembershipRole.MEMBER,
        });
        break;
      case "remove":
        await removeMember.mutateAsync(pendingAction.userId);
        break;
      case "revokeInvite":
        await revokeInvite.mutateAsync(pendingAction.inviteId);
        break;
    }

    setPendingAction(null);
  }

  function handlePromote(member: BookstoreMemberRecord) {
    void updateRole
      .mutateAsync({
        userId: member.userId,
        role: BookstoreMembershipRole.OWNER,
      })
      .catch(() => undefined);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.04em]">
            Members
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage who can access {bookstore.name}.
          </p>
        </div>
        <Button type="button" onClick={() => setInviteOpen(true)}>
          Create invite
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {membersQuery.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading members…
        </div>
      ) : membersQuery.error || !membersQuery.data ? (
        <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(membersQuery.error as Error | null)?.message || "Failed to load members."}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="space-y-1">
              <CardTitle>Access</CardTitle>
              <CardDescription>
                Members are active now. Invites are waiting for a matching sign-in.
              </CardDescription>
            </div>
            <div className="inline-flex rounded-full bg-muted p-1">
              {(
                [
                  ["members", `Members (${members.length})`],
                  ["invites", `Pending (${pendingInvites.length})`],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "font-display rounded-full px-3 py-1.5 text-sm tracking-[-0.025em] transition",
                    activeTab === tab
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardHeader>

          {activeTab === "members" ? (
            <CardContent className="p-0">
              {members.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No members yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const memberLabel = getMemberLabel(member);
                      const isSelf = member.userId === currentUserId;
                      const isOwner =
                        member.role === BookstoreMembershipRole.OWNER;
                      const isSuspended =
                        member.status ===
                        BookstoreMembershipStatus.SUSPENDED;
                      const extraCount = member.extraPermissions.length;

                      return (
                        <TableRow key={member.userId}>
                          <TableCell className="whitespace-normal">
                            <div className="flex items-center gap-3">
                              <div
                                aria-hidden
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                              >
                                {getMemberInitials(member)}
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <p className="flex flex-wrap items-center gap-2 font-medium">
                                  <span className="truncate">{memberLabel}</span>
                                  {isSelf ? (
                                    <Badge
                                      variant="outline"
                                      className="border-border/60 bg-background/80 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                                    >
                                      You
                                    </Badge>
                                  ) : null}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {member.email || "No email synced"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={isOwner ? "default" : "secondary"}
                              >
                                {getMembershipRoleLabel(member.role)}
                              </Badge>
                              {isSuspended ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 bg-amber-50 text-amber-800"
                                >
                                  Suspended
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isOwner ? (
                              <span className="text-xs text-muted-foreground">
                                All bookstore permissions
                              </span>
                            ) : extraCount === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                Standard access
                              </span>
                            ) : (
                              <Badge
                                variant="outline"
                                className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-800"
                              >
                                <ShieldCheck className="h-3 w-3" />
                                {extraCount} extra
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {!isOwner ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setPermissionsTarget({
                                      userId: member.userId,
                                      label: memberLabel,
                                      extraPermissions: member.extraPermissions,
                                    })
                                  }
                                  disabled={actionPending || isSelf}
                                >
                                  Permissions
                                </Button>
                              ) : null}
                              {isOwner ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setPendingAction({
                                      kind: "demote",
                                      userId: member.userId,
                                      label: memberLabel,
                                    })
                                  }
                                  disabled={actionPending || isSelf}
                                  title={
                                    isSelf
                                      ? "You cannot demote yourself."
                                      : undefined
                                  }
                                >
                                  Demote
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePromote(member)}
                                  disabled={actionPending || isSelf}
                                  title={
                                    isSelf
                                      ? "You cannot change your own role."
                                      : undefined
                                  }
                                >
                                  Promote
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
                                onClick={() =>
                                  setPendingAction({
                                    kind: "remove",
                                    userId: member.userId,
                                    label: memberLabel,
                                  })
                                }
                                disabled={actionPending || isSelf}
                                title={
                                  isSelf
                                    ? "You cannot remove yourself."
                                    : undefined
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          ) : (
            <CardContent className="space-y-3">
              {pendingInvites.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending invites.
                </p>
              ) : (
                pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-border/75 bg-background/70 px-4 py-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">{invite.invitedEmail}</p>
                      <p className="text-sm text-muted-foreground">
                        Created {formatUiDateTime(invite.createdAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
                      onClick={() =>
                        setPendingAction({
                          kind: "revokeInvite",
                          inviteId: invite.id,
                          label: invite.invitedEmail,
                        })
                      }
                      disabled={actionPending}
                    >
                      Revoke
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          )}
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create invite</DialogTitle>
            <DialogDescription>
              {bookstore.status === BookstoreStatus.APPROVED
                ? "Invite a teammate by email. They will be added automatically after signing in with that address."
                : "Invites unlock after the bookstore is approved."}
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              void handleInviteSubmit(event).catch(() => undefined);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={bookstore.status !== BookstoreStatus.APPROVED}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={createInvite.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  bookstore.status !== BookstoreStatus.APPROVED ||
                  createInvite.isPending
                }
              >
                {createInvite.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating invite
                  </>
                ) : (
                  "Create invite"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !actionPending) {
            setPendingAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionCopy.title}</DialogTitle>
            <DialogDescription>{actionCopy.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingAction(null)}
              disabled={actionPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white shadow-none hover:bg-red-700"
              onClick={() => {
                void handleConfirmAction().catch(() => undefined);
              }}
              disabled={actionPending}
            >
              {actionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {actionCopy.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PermissionsDialog
        bookstoreId={bookstoreId}
        open={permissionsTarget !== null}
        member={permissionsTarget}
        onOpenChange={(open) => {
          if (!open) setPermissionsTarget(null);
        }}
      />
    </div>
  );
}
