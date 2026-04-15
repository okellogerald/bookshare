"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, UserPlus } from "lucide-react";
import {
  useGrantStaffRole,
  useRevokeStaffRole,
  useStaffDirectory,
  useStaffIdentitySearch,
} from "@/shared/queries/staff";
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
import { cn } from "@/shared/lib/utils";
import type {
  StaffDirectoryEntry,
  StaffIdentitySearchResult,
} from "@/shared/api";

const ROLE_ORDER = ["owner", "manager", "staff", "viewer"] as const;

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
}

function canManageRole(actorRoles: string[], targetRole: string) {
  if (actorRoles.includes("owner")) {
    return true;
  }

  return actorRoles.includes("manager") && ["staff", "viewer"].includes(targetRole);
}

function formatIdentitySubtitle(
  entry: Pick<StaffDirectoryEntry, "email" | "userId">
) {
  return entry.email || entry.userId;
}

function RoleBadge({
  role,
  onRemove,
  disabled,
}: {
  role: string;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <Badge
      variant="secondary"
      className="gap-2 border border-border/75 bg-background px-3 py-1 text-xs text-foreground"
    >
      <span>{formatRole(role)}</span>
      {onRemove ? (
        <button
          type="button"
          className="rounded-full text-[10px] font-semibold leading-none text-muted-foreground transition hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-300"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${role} role`}
        >
          ×
        </button>
      ) : null}
    </Badge>
  );
}

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
          <p className="mt-1 text-xs text-muted-foreground">
            {candidate.emailVerified ? "Email verified" : "Email not verified"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {candidate.existingRoles.map((role) => (
            <RoleBadge key={`${candidate.userId}-${role}`} role={role} />
          ))}
        </div>
      </div>
    </button>
  );
}

export function StaffManagement({ actorRoles }: { actorRoles: string[] }) {
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [identityQuery, setIdentityQuery] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("staff");
  const deferredDirectoryQuery = useDeferredValue(directoryQuery);
  const deferredIdentityQuery = useDeferredValue(identityQuery);
  const directory = useStaffDirectory(deferredDirectoryQuery);
  const identitySearch = useStaffIdentitySearch(deferredIdentityQuery);
  const grantRole = useGrantStaffRole();
  const revokeRole = useRevokeStaffRole();

  const manageableRoles = useMemo(() => {
    if (actorRoles.includes("owner")) {
      return [...ROLE_ORDER];
    }

    if (actorRoles.includes("manager")) {
      return ["staff", "viewer"];
    }

    return [] as string[];
  }, [actorRoles]);

  const canManage = manageableRoles.length > 0;
  const directoryEntries = directory.data ?? [];
  const candidates = identitySearch.data ?? [];
  const selectedCandidate =
    candidates.find((candidate) => candidate.userId === selectedCandidateId) ?? null;

  useEffect(() => {
    if (selectedCandidateId && candidates.some((candidate) => candidate.userId === selectedCandidateId)) {
      return;
    }

    setSelectedCandidateId(candidates[0]?.userId ?? null);
  }, [candidates, selectedCandidateId]);

  useEffect(() => {
    if (manageableRoles.includes(selectedRole)) {
      return;
    }

    setSelectedRole(manageableRoles[0] ?? "staff");
  }, [manageableRoles, selectedRole]);

  const handleGrant = () => {
    if (!selectedCandidate || !selectedRole) {
      return;
    }

    grantRole.mutate({
      userId: selectedCandidate.userId,
      role: selectedRole,
    });
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap gap-3 border-b pb-6">
        <Badge variant="secondary" className="border border-border/75 bg-background px-3 py-1 text-foreground">
          {directory.isLoading
            ? "Loading directory"
            : `${directoryEntries.length} visible assignment${directoryEntries.length === 1 ? "" : "s"}`}
        </Badge>
        <Badge variant="secondary" className="border border-border/75 bg-background px-3 py-1 text-foreground">
          {canManage ? manageableRoles.map(formatRole).join(", ") : "Read-only access"}
        </Badge>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Current staff access</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search the staff directory and remove roles where your access level allows it.
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={directoryQuery}
              onChange={(event) => setDirectoryQuery(event.target.value)}
              placeholder="Search current staff by name, email, role, or user ID"
              className="pl-11"
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
                  <TableHead>Identity</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directoryEntries.map((entry) => (
                  <TableRow key={entry.userId}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{entry.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatIdentitySubtitle(entry)}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.userId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {entry.roles.map((assignment) => (
                          <RoleBadge
                            key={`${entry.userId}-${assignment.role}`}
                            role={assignment.role}
                            onRemove={
                              canManage && canManageRole(actorRoles, assignment.role)
                                ? () =>
                                    revokeRole.mutate({
                                      userId: entry.userId,
                                      role: assignment.role,
                                    })
                                : undefined
                            }
                            disabled={revokeRole.isPending}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Badge variant="outline">
                          {entry.emailVerified ? "Verified" : "Unverified"}
                        </Badge>
                        {entry.state ? (
                          <p className="text-xs text-muted-foreground">State: {entry.state}</p>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {revokeRole.isError ? (
            <p className="text-sm text-red-700">
              {revokeRole.error instanceof Error
                ? revokeRole.error.message
                : "Failed to revoke role."}
            </p>
          ) : null}
        </section>

        <section className="space-y-4 border-t pt-8 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Grant access</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Search identities, choose a role, then assign access.
              </p>
            </div>
          </div>

          {!canManage ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Your current admin role is read-only for staff management. Owners and managers can
              grant or revoke platform access here.
            </p>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={identityQuery}
                  onChange={(event) => setIdentityQuery(event.target.value)}
                  placeholder="Search identities by email, name, or user ID"
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

              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">Selected identity</p>
                </div>

                {selectedCandidate ? (
                  <>
                    <div>
                      <p className="font-medium text-foreground">{selectedCandidate.displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatIdentitySubtitle(selectedCandidate)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {manageableRoles.map((role) => {
                        const alreadyAssigned = selectedCandidate.existingRoles.includes(role);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setSelectedRole(role)}
                            className={cn(
                              "rounded-full border px-3 py-2 text-sm font-medium transition",
                              selectedRole === role
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border/75 bg-background text-foreground hover:border-primary/20"
                            )}
                          >
                            {formatRole(role)}
                            {alreadyAssigned ? " (current)" : ""}
                          </button>
                        );
                      })}
                    </div>

                    <Button
                      type="button"
                      onClick={handleGrant}
                      disabled={
                        grantRole.isPending ||
                        !selectedRole ||
                        selectedCandidate.existingRoles.includes(selectedRole)
                      }
                      className="rounded-full px-5"
                    >
                      {selectedCandidate.existingRoles.includes(selectedRole)
                        ? `${formatRole(selectedRole)} already assigned`
                        : grantRole.isPending
                          ? "Granting role..."
                          : `Grant ${formatRole(selectedRole)}`}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Pick a search result to assign a staff role.
                  </p>
                )}
              </div>

              {grantRole.isError ? (
                <p className="text-sm text-red-700">
                  {grantRole.error instanceof Error
                    ? grantRole.error.message
                    : "Failed to grant role."}
                </p>
              ) : null}

              <p className="text-xs leading-5 text-muted-foreground">
                Backend permissions update from the live staff-role store. Full admin shell access
                still refreshes on the next sign-in because the app keeps its own session snapshot.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
