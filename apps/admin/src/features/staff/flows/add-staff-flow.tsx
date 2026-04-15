"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  useGrantStaffRole,
  useStaffIdentitySearch,
} from "@/shared/queries/staff";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import type { StaffIdentitySearchResult } from "@/shared/api";
import {
  formatIdentitySubtitle,
  formatRole,
  getManageableRoles,
} from "@/features/staff/lib/staff-roles";
import { StaffRoleBadge } from "@/features/staff/components/staff-role-badge";

function IdentityResultCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: StaffIdentitySearchResult;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border-b py-4 text-left transition last:border-b-0",
        selected ? "bg-muted/35" : "hover:bg-muted/20"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div>
          <p className="font-semibold text-foreground">{candidate.displayName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatIdentitySubtitle(candidate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {candidate.existingRoles.map((role) => (
            <StaffRoleBadge key={`${candidate.userId}-${role}`} role={role} />
          ))}
        </div>
      </div>
    </button>
  );
}

export function AddStaffFlow({
  actorRoles,
  onComplete,
}: {
  actorRoles: string[];
  onComplete: () => void;
}) {
  const [identityQuery, setIdentityQuery] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const deferredIdentityQuery = useDeferredValue(identityQuery);
  const identitySearch = useStaffIdentitySearch(deferredIdentityQuery);
  const grantRole = useGrantStaffRole();
  const manageableRoles = useMemo(
    () => getManageableRoles(actorRoles),
    [actorRoles]
  );
  const [selectedRole, setSelectedRole] = useState<string>(manageableRoles[0] ?? "staff");

  const candidates = identitySearch.data ?? [];
  const selectedCandidate =
    candidates.find((candidate) => candidate.userId === selectedCandidateId) ?? null;

  useEffect(() => {
    if (
      selectedCandidateId &&
      candidates.some((candidate) => candidate.userId === selectedCandidateId)
    ) {
      return;
    }

    setSelectedCandidateId(candidates[0]?.userId ?? null);
  }, [candidates, selectedCandidateId]);

  useEffect(() => {
    if (manageableRoles.some((role) => role === selectedRole)) {
      return;
    }

    setSelectedRole(manageableRoles[0] ?? "staff");
  }, [manageableRoles, selectedRole]);

  const handleGrant = async () => {
    if (!selectedCandidate || !selectedRole) {
      return;
    }

    await grantRole.mutateAsync({
      userId: selectedCandidate.userId,
      role: selectedRole,
    });
    onComplete();
  };

  if (manageableRoles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Your current staff role does not allow granting staff access.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={identityQuery}
          onChange={(event) => setIdentityQuery(event.target.value)}
          placeholder="Search identities by email or name"
          className="pl-11"
        />
      </div>

      {deferredIdentityQuery.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Type at least two characters to search identities.
        </p>
      ) : identitySearch.isError ? (
        <p className="text-sm text-red-700">
          {identitySearch.error instanceof Error
            ? identitySearch.error.message
            : "Identity search failed."}
        </p>
      ) : identitySearch.isLoading ? (
        <p className="text-sm text-muted-foreground">Searching identities...</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No identities matched the current search.
        </p>
      ) : (
        <div className="divide-y border-y">
          {candidates.map((candidate) => (
            <IdentityResultCard
              key={candidate.userId}
              candidate={candidate}
              selected={candidate.userId === selectedCandidate?.userId}
              onSelect={() => setSelectedCandidateId(candidate.userId)}
            />
          ))}
        </div>
      )}

      {selectedCandidate ? (
        <div className="space-y-5 border-t pt-5">
          <div>
            <p className="font-medium text-foreground">{selectedCandidate.displayName}</p>
            <p className="text-sm text-muted-foreground">
              {formatIdentitySubtitle(selectedCandidate)}
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-muted-foreground">Role</legend>
            <div className="space-y-3">
              {manageableRoles.map((role) => {
                const checked = selectedRole === role;
                const alreadyAssigned = selectedCandidate.existingRoles.includes(role);

                return (
                  <label
                    key={role}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition",
                      checked
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/75 hover:border-primary/20"
                    )}
                  >
                    <input
                      type="radio"
                      name="staff-role"
                      value={role}
                      checked={checked}
                      onChange={() => setSelectedRole(role)}
                      className="mt-0.5 h-4 w-4 border-border text-primary focus:ring-primary"
                    />

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {formatRole(role)}
                        {alreadyAssigned ? " (current)" : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {alreadyAssigned
                          ? "This role is already assigned to the selected identity."
                          : "Grant this role to the selected identity."}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center justify-end gap-3 border-t pt-5">
            <Button type="button" variant="ghost" onClick={onComplete} disabled={grantRole.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleGrant()}
              disabled={
                grantRole.isPending ||
                !selectedRole ||
                selectedCandidate.existingRoles.includes(selectedRole)
              }
            >
              {selectedCandidate.existingRoles.includes(selectedRole)
                ? `${formatRole(selectedRole)} already assigned`
                : grantRole.isPending
                  ? "Granting role..."
                  : `Grant ${formatRole(selectedRole)}`}
            </Button>
          </div>

          {grantRole.isError ? (
            <p className="text-sm text-red-700">
              {grantRole.error instanceof Error
                ? grantRole.error.message
                : "Failed to grant role."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
