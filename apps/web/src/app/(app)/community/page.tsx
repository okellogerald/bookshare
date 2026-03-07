"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useCurrentUser } from "@/shared/providers/user-provider";
import { useCommunityMembers } from "@/shared/queries/community";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

function getInitials(value: string): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  const compact = words[0] ?? value.trim();
  if (!compact) return "U";
  return compact.slice(0, 2).toUpperCase();
}

export default function CommunityPage() {
  const currentUser = useCurrentUser();
  const [search, setSearch] = useState("");
  const { data: members, isLoading } = useCommunityMembers({
    search: search || undefined,
  });

  const sortedMembers = useMemo(() => {
    if (!members) return [];
    return [...members].sort((a, b) => a.username.localeCompare(b.username));
  }, [members]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Community</h1>
        <p className="text-muted-foreground">
          See who is in your reading community and how to reach them.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Members</CardTitle>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by username, name, or area..."
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading members...</p>
          ) : sortedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMembers.map((member) => {
                  const fullName = [member.first_name, member.last_name]
                    .filter((value): value is string => !!value && value.trim().length > 0)
                    .join(" ")
                    .trim();
                  const label = fullName || member.username || "U";
                  const isMe = currentUser?.id === member.user_id;

                  return (
                    <TableRow key={member.user_id}>
                      <TableCell>
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt={`${label} avatar`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{getInitials(label)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{fullName || "Name not set"}</p>
                        <p className="text-xs text-muted-foreground">
                          @{member.username}
                          {isMe ? " (You)" : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.city_area || "Not shared"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.contact_handle || "Not shared"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
