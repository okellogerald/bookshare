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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
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
      className="gap-2 bg-muted/70 px-3 py-1 text-xs text-foreground"
    >
      <span>{formatRole(role)}</span>
      {onRemove ? (
        <button
          type="button"
          className="rounded-full text-[10px] font-semibold leading-none text-slate-500 transition hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-300"
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
        "w-full rounded-[1.25rem] border p-4 text-left transition",
        selected
          ? "border-primary/60 bg-primary/5 shadow-[0_10px_25px_rgba(32,89,128,0.08)]"
          : "border-border/80 bg-background/75 hover:border-primary/30 hover:bg-white"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{candidate.displayName}</p>
          <p className="mt-1 text-sm text-slate-600">
            {formatIdentitySubtitle(candidate)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
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
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Current staff access</CardTitle>
            <CardDescription>
              Search the existing staff directory and remove roles where your own
              access level allows it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            ) : (directory.data ?? []).length === 0 ? (
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
                  {(directory.data ?? []).map((entry) => (
                    <TableRow key={entry.userId}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{entry.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatIdentitySubtitle(entry)}
                          </p>
                          <p className="text-xs text-slate-500">{entry.userId}</p>
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
                            <p className="text-xs text-slate-500">
                              State: {entry.state}
                            </p>
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
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-background/75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserPlus className="h-5 w-5 text-primary" />
              Grant access
            </CardTitle>
            <CardDescription>
              Search Kratos identities, choose a staff role, and assign platform
              access without leaving the admin app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canManage ? (
              <p className="rounded-[1.25rem] border border-border/80 bg-muted/50 p-4 text-sm leading-6 text-slate-600">
                Your current admin role is read-only for staff management. Owners and
                managers can grant or revoke platform access here.
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
                  <div className="space-y-3">
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

                <div className="rounded-[1.25rem] border border-border/80 bg-card/90 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="font-semibold">Selected identity</p>
                  </div>

                  {selectedCandidate ? (
                    <div className="mt-3 space-y-4">
                      <div>
                        <p className="font-medium">{selectedCandidate.displayName}</p>
                        <p className="text-sm text-slate-600">
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
                                  : "border-border bg-background text-foreground hover:border-primary/30"
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
                      >
                        {selectedCandidate.existingRoles.includes(selectedRole)
                          ? `${formatRole(selectedRole)} already assigned`
                          : grantRole.isPending
                            ? "Granting role..."
                            : `Grant ${formatRole(selectedRole)}`}
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
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

                <p className="text-xs leading-5 text-slate-500">
                  Backend permissions update from the live staff-role store. Full admin
                  shell access still refreshes on the next sign-in because the app shell
                  keeps its own session snapshot.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
