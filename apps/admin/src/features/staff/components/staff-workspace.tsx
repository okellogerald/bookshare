"use client";

import { useMemo, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { useStaffDirectory } from "@/shared/queries/staff";
import { RightPanel } from "@/shared/components/right-panel";
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
import type { StaffDirectoryEntry } from "@/shared/api";
import {
  formatIdentitySubtitle,
  getManageableRoles,
} from "@/features/staff/lib/staff-roles";
import { StaffRoleBadge } from "@/features/staff/components/staff-role-badge";
import { AddStaffFlow } from "@/features/staff/flows/add-staff-flow";
import { ManageStaffRolesFlow } from "@/features/staff/flows/manage-staff-roles-flow";

type StaffFlowState =
  | { type: "add" }
  | { type: "manage"; entry: StaffDirectoryEntry }
  | null;

export function StaffWorkspace({ actorRoles }: { actorRoles: string[] }) {
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [activeFlow, setActiveFlow] = useState<StaffFlowState>(null);
  const directory = useStaffDirectory(directoryQuery);
  const manageableRoles = useMemo(
    () => getManageableRoles(actorRoles),
    [actorRoles]
  );
  const canManage = manageableRoles.length > 0;
  const directoryEntries = directory.data ?? [];

  return (
    <section className="space-y-6">
      <PageIntro
        title="Staff management"
        description="Keep access narrow and explicit. Use page actions to open role-management flows while the default view stays focused on the current staff directory."
        actions={
          canManage ? (
            <Button type="button" className="rounded-full px-4" onClick={() => setActiveFlow({ type: "add" })}>
              <Plus className="h-4 w-4" />
              Add Staff
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <div className="relative">
          <Input
            value={directoryQuery}
            onChange={(event) => setDirectoryQuery(event.target.value)}
            placeholder="Search staff by name, email, or role"
            className="pl-4"
          />
        </div>

        {directory.isError ? (
          <p className="text-sm text-red-700">
            {directory.error instanceof Error
              ? directory.error.message
              : "Failed to load the staff directory."}
          </p>
        ) : directory.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading staff directory...</p>
        ) : directoryEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No staff assignments match the current search.
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
              {directoryEntries.map((entry) => (
                <TableRow key={entry.userId}>
                  <TableCell>
                    <p className="font-medium text-foreground">{entry.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatIdentitySubtitle(entry)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {entry.roles.map((assignment) => (
                        <StaffRoleBadge
                          key={`${entry.userId}-${assignment.role}`}
                          role={assignment.role}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="border border-border/75 bg-background text-muted-foreground">
                      {entry.emailVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setActiveFlow({ type: "manage", entry })}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Manage roles
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <RightPanel
        open={activeFlow !== null}
        onClose={() => setActiveFlow(null)}
        title={activeFlow?.type === "manage" ? "Manage staff roles" : "Add staff"}
        description={
          activeFlow?.type === "manage"
            ? "Adjust role assignments for the selected staff member without leaving the directory."
            : "Search identities, choose the right role, and grant access from this isolated flow."
        }
        size="lg"
      >
        {activeFlow?.type === "manage" ? (
          <ManageStaffRolesFlow
            actorRoles={actorRoles}
            entry={activeFlow.entry}
            onClose={() => setActiveFlow(null)}
          />
        ) : activeFlow?.type === "add" ? (
          <AddStaffFlow actorRoles={actorRoles} onComplete={() => setActiveFlow(null)} />
        ) : null}
      </RightPanel>
    </section>
  );
}
