"use client";

import { useEffect, useState } from "react";
import type { IdentityGender } from "@/shared/api";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  useMyProfile,
  useUpdateMyIdentity,
  useUpdateMyProfile,
} from "@/shared/queries/profile";

const genderOptions: Array<{ label: string; value: IdentityGender }> = [
  { label: "Unspecified", value: "GENDER_UNSPECIFIED" },
  { label: "Female", value: "GENDER_FEMALE" },
  { label: "Male", value: "GENDER_MALE" },
  { label: "Diverse", value: "GENDER_DIVERSE" },
];

function normalizeGender(value: string | null | undefined): IdentityGender {
  if (!value) return "GENDER_UNSPECIFIED";
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "GENDER_FEMALE" || normalized === "FEMALE") return "GENDER_FEMALE";
  if (normalized === "GENDER_MALE" || normalized === "MALE") return "GENDER_MALE";
  if (normalized === "GENDER_DIVERSE" || normalized === "DIVERSE") return "GENDER_DIVERSE";
  return "GENDER_UNSPECIFIED";
}

export default function ProfilePage() {
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<IdentityGender>("GENDER_UNSPECIFIED");
  const [cityArea, setCityArea] = useState("");
  const [contactHandle, setContactHandle] = useState("");

  const { data: myProfile, isLoading, isError, error } = useMyProfile();
  const updateIdentity = useUpdateMyIdentity();
  const updateProfile = useUpdateMyProfile();

  useEffect(() => {
    if (!myProfile) return;
    setUsername(myProfile.username ?? "");
    setFirstName(myProfile.firstName ?? "");
    setLastName(myProfile.lastName ?? "");
    setGender(normalizeGender(myProfile.gender));
    setCityArea(myProfile.cityArea ?? "");
    setContactHandle(myProfile.contactHandle ?? "");
  }, [myProfile]);

  async function handleSaveIdentity(e: React.FormEvent) {
    e.preventDefault();
    await updateIdentity.mutateAsync({
      username: username.trim() || undefined,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      gender,
    });
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    await updateProfile.mutateAsync({
      cityArea: cityArea.trim() || undefined,
      contactHandle: contactHandle.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your public handle and identity details here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>
            Username, first name, and last name are required. Gender is optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading profile...</p>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Failed to load profile."}
            </p>
          ) : (
            <>
              <form className="space-y-4" onSubmit={handleSaveIdentity}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input
                      id="first-name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input
                      id="last-name"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={gender} onValueChange={(value) => setGender(value as IdentityGender)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {genderOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={
                    updateIdentity.isPending ||
                    !username.trim() ||
                    !firstName.trim() ||
                    !lastName.trim()
                  }
                >
                  {updateIdentity.isPending ? "Saving..." : "Save Identity"}
                </Button>
                {updateIdentity.isError && (
                  <p className="text-sm text-destructive">
                    {updateIdentity.error instanceof Error
                      ? updateIdentity.error.message
                      : "Failed to save identity"}
                  </p>
                )}
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>App Profile</CardTitle>
          <CardDescription>
            These fields are used for community visibility and local coordination.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSaveProfile}>
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
        </CardContent>
      </Card>
    </div>
  );
}
