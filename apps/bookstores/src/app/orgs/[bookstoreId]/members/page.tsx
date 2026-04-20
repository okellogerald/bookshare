"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  BookstoreMembershipRole,
  BookstoreStatus,
} from "@bookshare/shared";
import {
  useBookstore,
  useBookstoreMembers,
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

export default function BookstoreMembersPage() {
  const params = useParams<{ bookstoreId: string }>();
  const bookstoreId = params.bookstoreId;
  const [inviteEmail, setInviteEmail] = useState("");
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

  const errorMessage =
    (membersQuery.error as Error | null)?.message ||
    (createInvite.error as Error | null)?.message ||
    (revokeInvite.error as Error | null)?.message ||
    (updateRole.error as Error | null)?.message ||
    (removeMember.error as Error | null)?.message ||
    null;

  async function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createInvite.mutateAsync({ email: inviteEmail });
    setInviteEmail("");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.04em]">
          Members
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage bookstore owners, members, and invite-only access.
        </p>
      </div>

      <BookstoreStatusBanner status={bookstore.status} reviewNote={bookstore.reviewNote} />

      {errorMessage ? (
        <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Invite member</CardTitle>
          <CardDescription>
            {bookstore.status === BookstoreStatus.APPROVED
              ? "Send an in-app invite by email."
              : "Invites unlock after the bookstore is approved."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleInviteSubmit}>
            <div className="flex-1 space-y-2">
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
            <Button
              type="submit"
              className="sm:mt-[1.65rem]"
              disabled={
                bookstore.status !== BookstoreStatus.APPROVED || createInvite.isPending
              }
            >
              {createInvite.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending invite
                </>
              ) : (
                "Create invite"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

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
        <>
          <Card>
            <CardHeader>
              <CardTitle>Current members</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersQuery.data.members.map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell className="whitespace-normal">
                        <div className="space-y-1">
                          <p className="font-medium">{member.displayName}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.email || "No email synced"}
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
                          {getMembershipRoleLabel(member.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatUiDateTime(member.joinedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {member.role === BookstoreMembershipRole.OWNER ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateRole.mutateAsync({
                                  userId: member.userId,
                                  role: BookstoreMembershipRole.MEMBER,
                                })
                              }
                            >
                              Demote
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateRole.mutateAsync({
                                  userId: member.userId,
                                  role: BookstoreMembershipRole.OWNER,
                                })
                              }
                            >
                              Promote
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => removeMember.mutateAsync(member.userId)}
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending invites</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {membersQuery.data.pendingInvites.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending invites.
                </p>
              ) : (
                membersQuery.data.pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-border/75 bg-background/70 px-4 py-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{invite.invitedEmail}</p>
                      <p className="text-sm text-muted-foreground">
                        Created {formatUiDateTime(invite.createdAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => revokeInvite.mutateAsync(invite.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
