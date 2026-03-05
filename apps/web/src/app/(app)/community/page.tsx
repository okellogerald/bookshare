"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useCurrentUser } from "@/shared/providers/user-provider";
import { useCommunityMembers, useMyProfile, useUpdateMyProfile } from "@/shared/queries/community";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export default function CommunityPage() {
  const currentUser = useCurrentUser();
  const [search, setSearch] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [cityArea, setCityArea] = useState("");
  const [contactHandle, setContactHandle] = useState("");

  const { data: members, isLoading } = useCommunityMembers({
    search: search || undefined,
  });
  const { data: myProfile, isLoading: myProfileLoading } = useMyProfile();
  const updateProfile = useUpdateMyProfile();

  useEffect(() => {
    if (!myProfile) return;
    setUsername(myProfile.username ?? "");
    setDisplayName(myProfile.displayName ?? "");
    setCityArea(myProfile.cityArea ?? "");
    setContactHandle(myProfile.contactHandle ?? "");
  }, [myProfile]);

  const sortedMembers = useMemo(() => {
    if (!members) return [];
    return [...members].sort((a, b) => a.username.localeCompare(b.username));
  }, [members]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    await updateProfile.mutateAsync({
      username: username.trim() || undefined,
      displayName: displayName.trim() || undefined,
      cityArea: cityArea.trim() || undefined,
      contactHandle: contactHandle.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Community</h1>
        <p className="text-muted-foreground">
          See who is in your reading community and how to reach them.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
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
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            @{member.username}
                            {isMe ? " (You)" : ""}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {member.display_name}
                          </p>
                        </div>
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

        <Card>
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {myProfileLoading ? (
              <p className="text-sm text-muted-foreground">Loading profile...</p>
            ) : (
              <form className="space-y-4" onSubmit={handleSaveProfile}>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="reader_name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display-name">Display Name</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city-area">City / Area</Label>
                  <Input
                    id="city-area"
                    value={cityArea}
                    onChange={(event) => setCityArea(event.target.value)}
                    placeholder="e.g. Downtown"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-handle">Preferred Contact</Label>
                  <Input
                    id="contact-handle"
                    value={contactHandle}
                    onChange={(event) => setContactHandle(event.target.value)}
                    placeholder="e.g. @telegram / phone / email"
                  />
                </div>
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? "Saving..." : "Save Profile"}
                </Button>
                {updateProfile.isError && (
                  <p className="text-sm text-destructive">
                    {updateProfile.error instanceof Error
                      ? updateProfile.error.message
                      : "Failed to save profile"}
                  </p>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
