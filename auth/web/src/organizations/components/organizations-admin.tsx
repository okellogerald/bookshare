"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Building2, Send } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatDateTime, organizationFetch } from "@/organizations/lib/api";
import type { AdminOrganizationSummary } from "@/organizations/lib/types";

export function OrganizationsAdmin() {
  const [organizations, setOrganizations] = useState<AdminOrganizationSummary[]>([]);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    try {
      setError(null);
      setOrganizations(
        await organizationFetch<AdminOrganizationSummary[]>(
          "admin/organizations",
          "GET"
        )
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load organizations.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError(null);
      await organizationFetch("admin/organizations", "POST", {
        name,
        adminEmail: adminEmail || undefined,
      });
      setName("");
      setAdminEmail("");
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to create organization.");
    } finally {
      setIsSaving(false);
    }
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
            <Badge variant="secondary">Platform admin</Badge>
            <h1 className="org-title">Organization admin</h1>
          </Stack>
        </Flex>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createOrganization}>
              <Stack gap={4}>
                <Stack gap={2}>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="adminEmail">Organization admin email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                  />
                </Stack>
                <Button type="submit" className="w-auto gap-2" disabled={isSaving}>
                  <Send className="h-4 w-4" />
                  Create
                </Button>
              </Stack>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Admins</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Invites</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((organization) => (
                  <TableRow key={organization.id}>
                    <TableCell className="font-medium">
                      <Flex align="center" gap={2}>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {organization.name}
                      </Flex>
                    </TableCell>
                    <TableCell>
                      {organization.adminNames.length
                        ? organization.adminNames.join(", ")
                        : "None"}
                    </TableCell>
                    <TableCell>{organization.memberCount}</TableCell>
                    <TableCell>{organization.pendingInviteCount}</TableCell>
                    <TableCell>{formatDateTime(organization.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Stack>
    </main>
  );
}
