"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useCurrentUser } from "@/shared/providers/user-provider";
import { useCommunityMembers } from "@/shared/queries/community";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";

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
            <div className="space-y-3">
              {sortedMembers.map((member) => {
                const isMe = currentUser?.id === member.user_id;
                return (
                  <div key={member.user_id} className="rounded-md border p-3">
                    <div>
                      <p className="font-medium">
                        @{member.username}
                        {isMe ? " (You)" : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.display_name}
                      </p>
                    </div>
                    <div className="mt-2 text-sm">
                      <p className="text-muted-foreground">
                        Area: {member.city_area || "Not shared"}
                      </p>
                      <p className="text-muted-foreground">
                        Contact: {member.contact_handle || "Not shared"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
