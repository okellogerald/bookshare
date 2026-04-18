"use client";

import { useEffect, useMemo, useState } from "react";
import { useGrantTeamRole, useRevokeTeamRole } from "@/domain/team/queries";
import { PlatformRole } from "@bookshare/shared";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import type { StaffDirectoryEntry } from "@/shared/api";
import {
  canManageRole,
  formatIdentitySubtitle,
  formatRole,
  getManageableRoles,
} from "@/domain/team/lib";
import { TeamRoleBadge } from "@/domain/team/team-role-badge";

export function ManageTeamMemberFlow({
  actorRoles,
  entry,
  onClose,
}: {
  actorRoles: string[];
  entry: StaffDirectoryEntry;
  onClose: () => void;
}) {
  const manageableRoles = useMemo(() => getManageableRoles(actorRoles), [actorRoles]);
  const [currentRoles, setCurrentRoles] = useState<string[]>(
    entry.roles.map((assignment) => assignment.role)
  );
  const [selectedRole, setSelectedRole] = useState<string>(
    manageableRoles[0] ?? PlatformRole.PLATFORM_STAFF
  );
  const grantRole = useGrantTeamRole();
  const revokeRole = useRevokeTeamRole();

  useEffect(() => {
    setCurrentRoles(entry.roles.map((assignment) => assignment.role));
  }, [entry]);

  useEffect(() => {
    if (manageableRoles.some((role) => role === selectedRole)) {
      return;
    }

    setSelectedRole(manageableRoles[0] ?? PlatformRole.PLATFORM_STAFF);
  }, [manageableRoles, selectedRole]);

  const handleGrant = async () => {
    if (!selectedRole || currentRoles.includes(selectedRole)) {
      return;
    }

    await grantRole.mutateAsync({
      userId: entry.userId,
      role: selectedRole,
    });
    setCurrentRoles((roles) => [...roles, selectedRole]);
  };

  const handleRevoke = async (role: string) => {
    await revokeRole.mutateAsync({
      userId: entry.userId,
      role,
    });
    setCurrentRoles((roles) => roles.filter((currentRole) => currentRole !== role));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-medium text-foreground">{entry.displayName}</p>
        <p className="mt-1 text-sm text-muted-foreground">{formatIdentitySubtitle(entry)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {entry.emailVerified ? "Email verified" : "Email not verified"}
          {entry.state ? ` • ${entry.state}` : ""}
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Current roles</h3>

        {currentRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {currentRoles.map((role) => (
              <TeamRoleBadge
                key={`${entry.userId}-${role}`}
                role={role}
                onRemove={
                  canManageRole(actorRoles, role)
                    ? () => void handleRevoke(role)
                    : undefined
                }
                disabled={revokeRole.isPending}
              />
            ))}
          </div>
        )}
      </section>

      {manageableRoles.length > 0 ? (
        <fieldset className="space-y-4 border-t pt-5">
          <legend className="text-sm font-medium text-muted-foreground">Add role</legend>

          <div className="space-y-4">
            {manageableRoles.map((role) => {
              const checked = selectedRole === role;
              const alreadyAssigned = currentRoles.includes(role);

              return (
                <label key={role} className="flex items-start gap-3">
                  <input
                    type="radio"
                    name={`manage-team-role-${entry.userId}`}
                    value={role}
                    checked={checked}
                    onChange={() => setSelectedRole(role)}
                    className="mt-1 h-4 w-4 border-border text-primary focus:ring-primary"
                  />

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {formatRole(role)}
                      {alreadyAssigned ? " (current)" : ""}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {alreadyAssigned
                        ? "This team member already has the selected role."
                        : "Grant this additional role to the selected team member."}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {grantRole.isError ? (
        <p className="text-sm text-red-700">
          {grantRole.error instanceof Error
            ? grantRole.error.message
            : "Failed to grant role."}
        </p>
      ) : null}

      {revokeRole.isError ? (
        <p className="text-sm text-red-700">
          {revokeRole.error instanceof Error
            ? revokeRole.error.message
            : "Failed to revoke role."}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t pt-5">
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button
          type="button"
          onClick={() => void handleGrant()}
          disabled={grantRole.isPending || !selectedRole || currentRoles.includes(selectedRole)}
        >
          {currentRoles.includes(selectedRole)
            ? `${formatRole(selectedRole)} already assigned`
            : grantRole.isPending
              ? "Granting role..."
              : `Grant ${formatRole(selectedRole)}`}
        </Button>
      </div>
    </div>
  );
}
