"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  useCreateProfileAvatarPresign,
  useMyProfile,
  useUpdateMyProfile,
} from "@/shared/queries/profile";

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

function formatGender(value: string | null | undefined) {
  if (!value) return "Not shared";
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "GENDER_FEMALE" || normalized === "FEMALE") {
    return "Female";
  }
  if (normalized === "GENDER_MALE" || normalized === "MALE") {
    return "Male";
  }
  return "Prefer not to say";
}

export default function ProfilePage() {
  const [location, setLocation] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const { data: myProfile, isLoading, isError, error } = useMyProfile();
  const updateProfile = useUpdateMyProfile();
  const createProfileAvatarPresign = useCreateProfileAvatarPresign();

  useEffect(() => {
    if (!myProfile) return;
    setLocation(myProfile.location ?? "");
    setContactNotes(myProfile.contactNotes ?? "");
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
        location: location.trim() || undefined,
        contactNotes: contactNotes.trim() || undefined,
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

  const identityLabel =
    [myProfile?.firstName, myProfile?.lastName]
      .filter((value): value is string => !!value?.trim())
      .join(" ")
      .trim() ||
    myProfile?.email ||
    "U";
  const avatarImageUrl = avatarPreviewUrl ?? avatarUrl;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Kratos manages your identity details. BookShare stores only your community-facing profile details here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>
            First name, last name, gender, and email are managed through account settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading profile...</p>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load profile."}
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Email
                  </p>
                  <p className="text-sm">{myProfile?.email || "Not available"}</p>
                </div>
                <div className="space-y-1 rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Gender
                  </p>
                  <p className="text-sm">{formatGender(myProfile?.gender)}</p>
                </div>
                <div className="space-y-1 rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    First Name
                  </p>
                  <p className="text-sm">{myProfile?.firstName || "Not set"}</p>
                </div>
                <div className="space-y-1 rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Last Name
                  </p>
                  <p className="text-sm">{myProfile?.lastName || "Not set"}</p>
                </div>
              </div>
              <Button type="button" asChild>
                <Link href="/auth/settings?returnTo=/profile">Manage Identity in Kratos</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Community Profile</CardTitle>
          <CardDescription>
            These details are stored in BookShare and used for local coordination.
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
                    <span>{getInitials(identityLabel)}</span>
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
                  {avatarFile ? (
                    <p className="text-xs text-muted-foreground">
                      Selected: {avatarFile.name}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="e.g. Downtown"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-notes">Contact Notes</Label>
              <Textarea
                id="contact-notes"
                value={contactNotes}
                onChange={(event) => setContactNotes(event.target.value)}
                placeholder="How members should contact you for book exchanges"
              />
              <p className="text-xs text-muted-foreground">
                This will be visible to other members on the platform.
              </p>
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
            {avatarError ? (
              <p className="text-sm text-destructive">{avatarError}</p>
            ) : null}
            {updateProfile.isError ? (
              <p className="text-sm text-destructive">
                {updateProfile.error instanceof Error
                  ? updateProfile.error.message
                  : "Failed to save profile"}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
