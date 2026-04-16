"use client";

import { useMemo, useState } from "react";
import { useMemberDirectory } from "@/domain/members/queries";
import { PageIntro } from "@/shared/components/page-intro";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

type MembersSort = "name_asc" | "joined_desc" | "copies_desc" | "wishes_desc";
type MembersStatusFilter = "all" | "active" | "deactivated";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function MembersWorkspace() {
  const membersQuery = useMemberDirectory();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<MembersSort>("name_asc");
  const [statusFilter, setStatusFilter] = useState<MembersStatusFilter>("all");
  const members = membersQuery.data ?? [];

  const filteredMembers = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return members
      .filter((member) => {
        if (statusFilter !== "all" && member.status !== statusFilter) {
          return false;
        }

        if (!normalized) {
          return true;
        }

        const haystacks = [
          member.displayName.toLowerCase(),
          member.email.toLowerCase(),
          member.location?.toLowerCase() ?? "",
        ];

        return haystacks.some((value) => value.includes(normalized));
      })
      .sort((left, right) => {
        switch (sortBy) {
          case "joined_desc":
            return right.created_at.localeCompare(left.created_at);
          case "copies_desc":
            return right.copyCount - left.copyCount || left.displayName.localeCompare(right.displayName);
          case "wishes_desc":
            return (
              right.activeWishCount - left.activeWishCount ||
              left.displayName.localeCompare(right.displayName)
            );
          case "name_asc":
          default:
            return left.displayName.localeCompare(right.displayName, undefined, {
              sensitivity: "base",
            });
        }
      });
  }, [members, search, sortBy, statusFilter]);

  return (
    <section className="space-y-6">
      <PageIntro
        title="Members"
        description="Manage member accounts from a searchable directory. Lifecycle actions such as deactivate, reactivate, and password reset can land here next."
      />

      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members by name, email, or location"
          />
          <Select value={sortBy} onChange={(event) => setSortBy(event.target.value as MembersSort)}>
            <option value="name_asc">Sort: Name</option>
            <option value="joined_desc">Sort: Recently Joined</option>
            <option value="copies_desc">Sort: Most Copies</option>
            <option value="wishes_desc">Sort: Most Wishes</option>
          </Select>
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as MembersStatusFilter)}
          >
            <option value="all">Status: All</option>
            <option value="active">Status: Active</option>
            <option value="deactivated">Status: Deactivated</option>
          </Select>
        </div>

        {membersQuery.isError ? (
          <p className="text-sm text-red-700">
            {membersQuery.error instanceof Error
              ? membersQuery.error.message
              : "Failed to load members."}
          </p>
        ) : membersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading members...</p>
        ) : filteredMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No members match the current filters.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Copies</TableHead>
                <TableHead>Active Wishes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.user_id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{member.displayName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{member.email}</p>
                  </TableCell>
                  <TableCell>{member.location || "—"}</TableCell>
                  <TableCell>{member.copyCount}</TableCell>
                  <TableCell>{member.activeWishCount}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="border border-border/75 bg-background text-muted-foreground"
                    >
                      {member.status === "active" ? "Active" : "Deactivated"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(member.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}
