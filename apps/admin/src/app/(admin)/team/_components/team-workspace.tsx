"use client";

import { useMemo, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { useAdminFlow } from "@/flows/admin-flow-provider";
import { useTeamDirectory } from "@/domain/team/queries";
import { PageIntro } from "@/shared/components/page-intro";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  formatIdentitySubtitle,
  getManageableRoles,
} from "@/domain/team/lib";
import { TeamRoleBadge } from "@/domain/team/team-role-badge";

export function TeamWorkspace({
  actorRoles,
  actorUserId,
}: {
  actorRoles: string[];
  actorUserId: string;
}) {
  const [directoryQuery, setDirectoryQuery] = useState("");
  const { openFlow } = useAdminFlow();
  const directory = useTeamDirectory(directoryQuery);
  const manageableRoles = useMemo(() => getManageableRoles(actorRoles), [actorRoles]);
  const canManage = manageableRoles.length > 0;
  const directoryEntries = directory.data ?? [];

  return (
    <section className="space-y-6">
      <PageIntro
        title="Team Management"
        description="Keep admin access narrow and explicit. The default view stays focused on the current team directory, while role changes happen inside isolated flows."
        actions={
          canManage ? (
            <Button
              type="button"
              className="rounded-full px-4"
              onClick={() => openFlow({ kind: "add-team-member", actorRoles, actorUserId })}
            >
              <Plus className="h-4 w-4" />
              Add Team Member
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <div className="relative">
          <Input
            value={directoryQuery}
            onChange={(event) => setDirectoryQuery(event.target.value)}
            placeholder="Search team members by name, email, or role"
            className="pl-4"
          />
        </div>

        {directory.isError ? (
          <p className="text-sm text-red-700">
            {directory.error instanceof Error
              ? directory.error.message
              : "Failed to load the team directory."}
          </p>
        ) : directory.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading team directory...</p>
        ) : directoryEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No team assignments match the current search.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {directoryEntries.map((entry) => {
                const isSelf = entry.userId === actorUserId;

                return (
                  <TableRow key={entry.userId}>
                    <TableCell className="min-w-[180px] whitespace-normal">
                      <p className="font-medium text-foreground">
                        {entry.displayName}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatIdentitySubtitle(entry)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {entry.roles.map((assignment) => (
                          <TeamRoleBadge key={`${entry.userId}-${assignment.role}`} role={assignment.role} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="border border-border/75 bg-background text-muted-foreground"
                      >
                        {entry.emailVerified ? "Verified" : "Unverified"}
                      </Badge>
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        {isSelf ? (
                          // Admins can't modify their own roles from the directory.
                          // Changes to the signed-in user's roles must come from
                          // another admin to prevent self-lockout or self-escalation.
                          <span className="text-xs text-muted-foreground">
                            Can't edit your own roles
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() =>
                              openFlow({
                                kind: "manage-team-member",
                                actorRoles,
                                actorUserId,
                                entry,
                              })
                            }
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Manage roles
                          </Button>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}
