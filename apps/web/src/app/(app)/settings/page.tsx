"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useMyProfile } from "@/shared/queries/profile";
import {
  useChangeMyEmail,
  useChangeMyPassword,
  useDeactivateMyAccount,
  useDeleteMyAccount,
} from "@/shared/queries/settings";

export default function SettingsPage() {
  const { data: myProfile, isLoading, isError, error } = useMyProfile();

  const changeEmail = useChangeMyEmail();
  const changePassword = useChangeMyPassword();
  const deactivateAccount = useDeactivateMyAccount();
  const deleteAccount = useDeleteMyAccount();

  const [email, setEmail] = useState("");
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [deactivateConfirmation, setDeactivateConfirmation] = useState("");
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!myProfile?.email) return;
    setEmail(myProfile.email);
  }, [myProfile?.email]);

  const deactivateReady = useMemo(
    () =>
      deactivatePassword.trim().length > 0 &&
      deactivateConfirmation.trim().toUpperCase() === "DEACTIVATE",
    [deactivateConfirmation, deactivatePassword]
  );

  const deleteReady = useMemo(
    () =>
      deletePassword.trim().length > 0 &&
      deleteConfirmation.trim().toUpperCase() === "DELETE",
    [deleteConfirmation, deletePassword]
  );

  async function submitEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailSuccess(null);
    try {
      await changeEmail.mutateAsync({ email: email.trim() });
      setEmailSuccess("Email update requested. Complete verification in your inbox.");
    } catch {
      // Error state is surfaced by react-query mutation state below.
    }
  }

  async function submitPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    try {
      await changePassword.mutateAsync({
        oldPassword: currentPassword,
        newPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated successfully.");
    } catch {
      // Error state is surfaced by react-query mutation state below.
    }
  }

  async function confirmDeactivation() {
    try {
      await deactivateAccount.mutateAsync({
        password: deactivatePassword,
        confirmation: "DEACTIVATE",
      });

      window.location.href = "/api/auth/logout";
    } catch {
      // Error state is surfaced by react-query mutation state below.
    }
  }

  async function confirmDeletion() {
    try {
      await deleteAccount.mutateAsync({
        password: deletePassword,
        confirmation: "DELETE",
      });

      window.location.href = "/api/auth/logout";
    } catch {
      // Error state is surfaced by react-query mutation state below.
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage account security and high-impact account actions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Change your login email and password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading profile...</p>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load profile."}
            </p>
          ) : (
            <>
              <form className="space-y-3" onSubmit={submitEmailChange}>
                <div className="space-y-2">
                  <Label htmlFor="security-email">Login Email</Label>
                  <Input
                    id="security-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Changing email triggers a verification flow.
                </p>
                <Button type="submit" disabled={changeEmail.isPending || !email.trim()}>
                  {changeEmail.isPending ? "Updating..." : "Change Email"}
                </Button>
                {emailSuccess && (
                  <p className="text-sm text-emerald-700">{emailSuccess}</p>
                )}
                {changeEmail.isError && (
                  <p className="text-sm text-destructive">
                    {changeEmail.error instanceof Error
                      ? changeEmail.error.message
                      : "Failed to update email."}
                  </p>
                )}
              </form>

              <div className="border-t" />

              <form className="space-y-3" onSubmit={submitPasswordChange}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={
                    changePassword.isPending ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                >
                  {changePassword.isPending ? "Updating..." : "Reset Password"}
                </Button>
                {passwordSuccess && (
                  <p className="text-sm text-emerald-700">{passwordSuccess}</p>
                )}
                {passwordError && (
                  <p className="text-sm text-destructive">{passwordError}</p>
                )}
                {changePassword.isError && (
                  <p className="text-sm text-destructive">
                    {changePassword.error instanceof Error
                      ? changePassword.error.message
                      : "Failed to update password."}
                  </p>
                )}
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dangerous Actions</CardTitle>
          <CardDescription>
            Deactivate or permanently delete your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-md border p-4">
            <div>
              <h3 className="font-semibold">Deactivate Account</h3>
              <p className="text-sm text-muted-foreground">
                Deactivation blocks sign-in until reactivated.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deactivate-password">Password</Label>
                <Input
                  id="deactivate-password"
                  type="password"
                  value={deactivatePassword}
                  onChange={(event) => setDeactivatePassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deactivate-confirmation">Type DEACTIVATE</Label>
                <Input
                  id="deactivate-confirmation"
                  value={deactivateConfirmation}
                  onChange={(event) =>
                    setDeactivateConfirmation(event.target.value.toUpperCase())
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!deactivateReady || deactivateAccount.isPending}
              onClick={() => setDeactivateDialogOpen(true)}
            >
              {deactivateAccount.isPending ? "Deactivating..." : "Deactivate Account"}
            </Button>
            {deactivateAccount.isError && (
              <p className="text-sm text-destructive">
                {deactivateAccount.error instanceof Error
                  ? deactivateAccount.error.message
                  : "Failed to deactivate account."}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-destructive/40 p-4">
            <div>
              <h3 className="font-semibold text-destructive">Delete Account</h3>
              <p className="text-sm text-muted-foreground">
                Profile and copy details are deleted. Books, editions, and authors are not deleted.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delete-password">Password</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-confirmation">Type DELETE</Label>
                <Input
                  id="delete-confirmation"
                  value={deleteConfirmation}
                  onChange={(event) =>
                    setDeleteConfirmation(event.target.value.toUpperCase())
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteReady || deleteAccount.isPending}
              onClick={() => setDeleteDialogOpen(true)}
            >
              {deleteAccount.isPending ? "Deleting..." : "Delete Account"}
            </Button>
            {deleteAccount.isError && (
              <p className="text-sm text-destructive">
                {deleteAccount.error instanceof Error
                  ? deleteAccount.error.message
                  : "Failed to delete account."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>
            Current handling of profile and activity data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Your profile stores identity details, contact preferences, and avatar metadata.</p>
          <p>Your app activity stores copies, wants, and related history needed for library workflows.</p>
          <p>Deleting your account removes profile and copy details but keeps shared catalog entities.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Current outbound notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Security notifications are sent for account-related authentication events.</p>
          <p>Transactional notifications are sent for submission acknowledgements and system-required updates.</p>
          <p>Granular notification preference controls are not yet available.</p>
        </CardContent>
      </Card>

      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deactivation</DialogTitle>
            <DialogDescription>
              You are about to deactivate your account. You will not be able to sign in until reactivated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateDialogOpen(false)}
              disabled={deactivateAccount.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeactivation}
              disabled={!deactivateReady || deactivateAccount.isPending}
            >
              {deactivateAccount.isPending ? "Deactivating..." : "Confirm Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Permanent Deletion</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Profile and copy details are permanently deleted.
              Books, editions, and authors are retained.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteAccount.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeletion}
              disabled={!deleteReady || deleteAccount.isPending}
            >
              {deleteAccount.isPending ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
