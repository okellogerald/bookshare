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
  useCreateProfileAvatarPresign,
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

export default function ProfilePage() {
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<IdentityGender>("GENDER_UNSPECIFIED");
  const [cityArea, setCityArea] = useState("");
  const [contactHandle, setContactHandle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const { data: myProfile, isLoading, isError, error } = useMyProfile();
  const updateIdentity = useUpdateMyIdentity();
  const updateProfile = useUpdateMyProfile();
  const createProfileAvatarPresign = useCreateProfileAvatarPresign();

  useEffect(() => {
    if (!myProfile) return;
    setUsername(myProfile.username ?? "");
    setFirstName(myProfile.firstName ?? "");
    setLastName(myProfile.lastName ?? "");
    setGender(normalizeGender(myProfile.gender));
    setCityArea(myProfile.cityArea ?? "");
    setContactHandle(myProfile.contactHandle ?? "");
    setAvatarUrl(myProfile.avatarUrl ?? null);
    setAvatarFile(null);
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarPreviewUrl(null);
    setAvatarDirty(false);
    setAvatarError(null);
  }, [myProfile]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  function handleAvatarSelection(files: FileList | null) {
    if (!files?.[0]) return;
    const file = files[0];

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
      setAvatarPreviewUrl(null);
      setAvatarFile(null);
      setAvatarError("Only jpg, png, and webp images are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
      setAvatarPreviewUrl(null);
      setAvatarFile(null);
      setAvatarError("Profile image must be 5MB or less.");
      return;
    }

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarPreviewUrl(URL.createObjectURL(file));
    setAvatarFile(file);
    setAvatarDirty(true);
    setAvatarError(null);
  }

  function handleRemoveAvatar() {
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarPreviewUrl(null);
    setAvatarFile(null);
    setAvatarUrl(null);
    setAvatarDirty(true);
    setAvatarError(null);
  }

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
    setAvatarError(null);

    try {
      let nextAvatarUrl: string | null | undefined = undefined;

      if (avatarFile) {
        const presign = await createProfileAvatarPresign.mutateAsync({
          fileName: avatarFile.name,
          contentType: avatarFile.type,
          fileSize: avatarFile.size,
        });
        const uploadResponse = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": avatarFile.type },
          body: avatarFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload profile image.");
        }

        nextAvatarUrl = presign.publicUrl;
      } else if (avatarDirty) {
        nextAvatarUrl = avatarUrl;
      }

      await updateProfile.mutateAsync({
        cityArea: cityArea.trim() || undefined,
        contactHandle: contactHandle.trim() || undefined,
        avatarUrl: nextAvatarUrl,
      });

      if (nextAvatarUrl !== undefined) {
        setAvatarUrl(nextAvatarUrl);
      }

      if (avatarFile && avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
        setAvatarPreviewUrl(null);
      }
      setAvatarFile(null);
      setAvatarDirty(false);
    } catch (saveError) {
      setAvatarError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save profile picture."
      );
    }
  }

  const avatarDisplayName =
    [firstName, lastName]
      .filter((value) => !!value?.trim())
      .join(" ")
      .trim() || username || "U";
  const avatarImageUrl = avatarPreviewUrl ?? avatarUrl;

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
              <Label>Profile Picture</Label>
              <div className="flex flex-wrap items-center gap-4 rounded-md border p-3">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-semibold">
                  {avatarImageUrl ? (
                    <img
                      src={avatarImageUrl}
                      alt="Profile avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(avatarDisplayName)}</span>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => handleAvatarSelection(event.target.files)}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemoveAvatar}
                      disabled={!avatarImageUrl && !avatarFile}
                    >
                      Remove Photo
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, or WEBP up to 5MB.
                  </p>
                  {avatarFile && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {avatarFile.name}
                    </p>
                  )}
                </div>
              </div>
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
            <Button
              type="submit"
              disabled={
                updateProfile.isPending || createProfileAvatarPresign.isPending
              }
            >
              {updateProfile.isPending || createProfileAvatarPresign.isPending
                ? "Saving..."
                : "Save Profile"}
            </Button>
            {avatarError && (
              <p className="text-sm text-destructive">{avatarError}</p>
            )}
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
