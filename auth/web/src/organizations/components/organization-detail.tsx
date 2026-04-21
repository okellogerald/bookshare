"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Flex, Stack } from "@/shared/components/ui/flex";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  formatDateTime,
  getRoleLabel,
  organizationFetch,
} from "@/organizations/lib/api";
import type {
  OrganizationDetail as OrganizationDetailType,
  OrganizationMembersResponse,
  OrganizationRole,
} from "@/organizations/lib/types";

interface OrganizationDetailProps {
  organizationId: string;
}

export function OrganizationDetail({ organizationId }: OrganizationDetailProps) {
  const [organization, setOrganization] = useState<OrganizationDetailType | null>(null);
  const [members, setMembers] = useState<OrganizationMembersResponse | null>(null);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("staff");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    try {
      setError(null);
      const nextOrganization = await organizationFetch<OrganizationDetailType>(
        `organizations/${organizationId}`,
        "GET"
      );
      setOrganization(nextOrganization);
      setName(nextOrganization.name);
      if (nextOrganization.canManageMembers) {
        setMembers(
          await organizationFetch<OrganizationMembersResponse>(
            `organizations/${organizationId}/members`,
            "GET"
          )
        );
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load organization.");
    }
  }

  useEffect(() => {
    void load();
  }, [organizationId]);

  async function updateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError(null);
      const updated = await organizationFetch<OrganizationDetailType>(
        `organizations/${organizationId}`,
        "PATCH",
        { name }
      );
      setOrganization(updated);
      setName(updated.name);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update organization.");
    } finally {
      setIsSaving(false);
    }
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError(null);
      await organizationFetch(`organizations/${organizationId}/invites`, "POST", {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteRole("staff");
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to create invite.");
    } finally {
      setIsSaving(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    try {
      setIsSaving(true);
      setError(null);
      await organizationFetch(
        `organizations/${organizationId}/invites/${inviteId}`,
        "DELETE"
      );
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to revoke invite.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!organization && !error) {
    return <main className="org-page">Loading organization...</main>;
  }

  return (
    <main className="org-page">
      <Stack gap={6}>
        <Flex justify="between" align="start" gap={4} wrap>
          <Stack gap={2}>
            <Button asChild variant="ghost" className="w-auto gap-2 px-0">
              <Link href="/organizations">
                <ArrowLeft className="h-4 w-4" />
                Organizations
              </Link>
            </Button>
            <Badge variant="secondary">{organization?.status ?? "Organization"}</Badge>
            <h1 className="org-title">{organization?.name ?? "Organization"}</h1>
          </Stack>
        </Flex>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        {organization ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent>
              {organization.canManageMembers ? (
                <form onSubmit={updateOrganization}>
                  <Stack gap={4}>
                    <Stack gap={2}>
                      <Label htmlFor="organizationName">Name</Label>
                      <Input
                        id="organizationName"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </Stack>
                    <Button type="submit" className="w-auto" disabled={isSaving}>
                      Save
                    </Button>
                  </Stack>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {getRoleLabel(organization.myRole)} access
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {organization?.canManageMembers ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <Stack gap={5}>
                <form onSubmit={createInvite}>
                  <Flex align="end" gap={3} wrap>
                    <Stack gap={2} className="min-w-[260px] flex-1">
                      <Label htmlFor="inviteEmail">Email</Label>
                      <Input
                        id="inviteEmail"
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                      />
                    </Stack>
                    <Stack gap={2} className="w-[160px]">
                      <Label>Role</Label>
                      <Select
                        value={inviteRole}
                        onValueChange={(value) => setInviteRole(value as OrganizationRole)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </Stack>
                    <Button type="submit" className="w-auto gap-2" disabled={isSaving}>
                      <Send className="h-4 w-4" />
                      Invite
                    </Button>
                  </Flex>
                </form>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(members?.members ?? []).map((member) => (
                      <TableRow key={member.userId}>
                        <TableCell className="font-medium">{member.displayName}</TableCell>
                        <TableCell>{member.email ?? "Unknown"}</TableCell>
                        <TableCell>{getRoleLabel(member.role)}</TableCell>
                        <TableCell>{formatDateTime(member.joinedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Stack gap={3}>
                  {(members?.pendingInvites ?? []).map((invite) => (
                    <Flex
                      key={invite.id}
                      align="center"
                      justify="between"
                      gap={3}
                      wrap
                      className="rounded-md border p-3"
                    >
                      <Stack gap={1}>
                        <p className="text-sm font-medium">{invite.invitedEmail}</p>
                        <p className="text-xs text-muted-foreground">
                          {getRoleLabel(invite.role)} invite sent {formatDateTime(invite.createdAt)}
                        </p>
                      </Stack>
                      <Button
                        variant="outline"
                        className="w-auto gap-2"
                        disabled={isSaving}
                        onClick={() => revokeInvite(invite.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Revoke
                      </Button>
                    </Flex>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Stack>
    </main>
  );
}
