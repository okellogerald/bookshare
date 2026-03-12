"use client";

import { useEffect, useMemo, useState } from "react";
import { Key, Mail, Trash2, UserX } from "lucide-react";
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
  const [changeEmailDialogOpen, setChangeEmailDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);

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
          Manage account actions and privacy preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            Select an action to update credentials or manage account status.
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
              <div className="rounded-md border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Active login email
                </p>
                <p className="text-sm font-medium">{myProfile?.email || "Unknown"}</p>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col items-start justify-between gap-3 rounded-md border p-4 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <p className="font-medium">Change Email</p>
                    <p className="text-sm text-muted-foreground">
                      Update the email used for sign in.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEmailSuccess(null);
                      changeEmail.reset();
                      setChangeEmailDialogOpen(true);
                    }}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Change Email
                  </Button>
                </div>

                <div className="flex flex-col items-start justify-between gap-3 rounded-md border p-4 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <p className="font-medium">Change Password</p>
                    <p className="text-sm text-muted-foreground">
                      Rotate your password for account security.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPasswordError(null);
                      setPasswordSuccess(null);
                      changePassword.reset();
                      setChangePasswordDialogOpen(true);
                    }}
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Change Password
                  </Button>
                </div>

                <div className="flex flex-col items-start justify-between gap-3 rounded-md border p-4 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <p className="font-medium">Deactivate Account</p>
                    <p className="text-sm text-muted-foreground">
                      Disable login until the account is reactivated.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      deactivateAccount.reset();
                      setDeactivateDialogOpen(true);
                    }}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Deactivate Account
                  </Button>
                </div>

                <div className="flex flex-col items-start justify-between gap-3 rounded-md border border-destructive/40 p-4 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <p className="font-medium text-destructive">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently remove profile and account-owned records.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      deleteAccount.reset();
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </>
          )}
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
          <p>None of your contact details are shared with any third party.</p>
          <p>Your app activity stores copies, wishlist entries, and related history needed for library workflows.</p>
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

      <Dialog open={changeEmailDialogOpen} onOpenChange={setChangeEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email</DialogTitle>
            <DialogDescription>
              Update your sign-in email. A verification step will be required.
            </DialogDescription>
          </DialogHeader>
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChangeEmailDialogOpen(false)}
                disabled={changeEmail.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={changeEmail.isPending || !email.trim()}>
                {changeEmail.isPending ? "Updating..." : "Save Email"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={changePasswordDialogOpen}
        onOpenChange={setChangePasswordDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password, then set a new one.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitPasswordChange}>
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
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChangePasswordDialogOpen(false)}
                disabled={changePassword.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  changePassword.isPending ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                {changePassword.isPending ? "Updating..." : "Save Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deactivation</DialogTitle>
            <DialogDescription>
              You are about to deactivate your account. You will not be able to sign in until reactivated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
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
            {deactivateAccount.isError && (
              <p className="text-sm text-destructive">
                {deactivateAccount.error instanceof Error
                  ? deactivateAccount.error.message
                  : "Failed to deactivate account."}
              </p>
            )}
          </div>
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
          <div className="space-y-3">
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
            {deleteAccount.isError && (
              <p className="text-sm text-destructive">
                {deleteAccount.error instanceof Error
                  ? deleteAccount.error.message
                  : "Failed to delete account."}
              </p>
            )}
          </div>
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
