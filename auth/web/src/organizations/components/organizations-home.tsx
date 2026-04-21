"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Check, LogOut, Shield } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Flex, Stack } from "@/shared/components/ui/flex";
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
import type { OrganizationsMeResponse } from "@/organizations/lib/types";
import { isPlatformAdminRole } from "@/organizations/auth/roles";

export function OrganizationsHome() {
  const [data, setData] = useState<OrganizationsMeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setData(await organizationFetch<OrganizationsMeResponse>("organizations/me", "GET"));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load organizations.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function acceptInvite(inviteId: string) {
    try {
      setBusyInviteId(inviteId);
      setData(
        await organizationFetch<OrganizationsMeResponse>(
          `organizations/invites/${inviteId}/accept`,
          "POST"
        )
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to accept invite.");
    } finally {
      setBusyInviteId(null);
    }
  }

  if (!data && !error) {
    return <div className="org-page">Loading organizations...</div>;
  }

  const isPlatformAdmin = data?.user.roles.some(isPlatformAdminRole) ?? false;

  return (
    <main className="org-page">
      <Stack gap={6}>
        <Flex justify="between" align="start" gap={4} wrap>
          <Stack gap={2}>
            <Badge variant="secondary">Auth Organizations</Badge>
            <h1 className="org-title">Organizations</h1>
            {data?.user.email ? (
              <p className="org-muted">{data.user.email}</p>
            ) : null}
          </Stack>
          <Flex gap={2} wrap>
            {isPlatformAdmin ? (
              <Button asChild variant="outline" className="w-auto gap-2">
                <Link href="/organizations/admin">
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" className="w-auto gap-2">
              <Link href="/api/auth/logout">
                <LogOut className="h-4 w-4" />
                Sign out
              </Link>
            </Button>
          </Flex>
        </Flex>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        {data?.pendingInvites.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending invites</CardTitle>
              <CardDescription>Invites matched to your verified email.</CardDescription>
            </CardHeader>
            <CardContent>
              <Stack gap={3}>
                {data.pendingInvites.map((invite) => (
                  <Flex
                    key={invite.id}
                    align="center"
                    justify="between"
                    gap={3}
                    wrap
                    className="rounded-md border p-3"
                  >
                    <Stack gap={1}>
                      <p className="text-sm font-medium">{invite.organization.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getRoleLabel(invite.role)} invite sent {formatDateTime(invite.createdAt)}
                      </p>
                    </Stack>
                    <Button
                      className="w-auto gap-2"
                      onClick={() => acceptInvite(invite.id)}
                      disabled={busyInviteId === invite.id}
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </Button>
                  </Flex>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Memberships</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.memberships.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.memberships.map((membership) => (
                    <TableRow key={membership.organizationId}>
                      <TableCell className="font-medium">
                        <Flex align="center" gap={2}>
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {membership.organization.name}
                        </Flex>
                      </TableCell>
                      <TableCell>{getRoleLabel(membership.role)}</TableCell>
                      <TableCell>{formatDateTime(membership.joinedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" className="w-auto">
                          <Link href={`/organizations/${membership.organizationId}`}>
                            Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No memberships yet.</p>
            )}
          </CardContent>
        </Card>
      </Stack>
    </main>
  );
}
