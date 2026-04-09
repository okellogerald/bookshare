"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { useMyProfile } from "@/shared/queries/profile";
import {
  useDeactivateMyAccount,
  useDeleteMyAccount,
} from "@/shared/queries/settings";

export default function SettingsPage() {
  const { data: myProfile, isLoading, isError, error } = useMyProfile();

  const deactivateAccount = useDeactivateMyAccount();
  const deleteAccount = useDeleteMyAccount();

  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [deactivateConfirmation, setDeactivateConfirmation] = useState("");
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
          Manage identity settings through Kratos and handle account-level actions here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>
            Email, password, first name, last name, and gender are managed through Kratos.
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
                  Current sign-in email
                </p>
                <p className="text-sm font-medium">{myProfile?.email || "Unknown"}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col justify-between gap-3 rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="font-medium">Manage Identity</p>
                    <p className="text-sm text-muted-foreground">
                      Update name, gender, and login email in the identity provider.
                    </p>
                  </div>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/auth/settings?section=profile">
                      <Mail className="mr-2 h-4 w-4" />
                      Open Profile Settings
                    </Link>
                  </Button>
                </div>

                <div className="flex flex-col justify-between gap-3 rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="font-medium">Manage Password</p>
                    <p className="text-sm text-muted-foreground">
                      Password changes use the same Kratos settings flow with a dedicated password view.
                    </p>
                  </div>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/auth/settings?section=password">
                      <Key className="mr-2 h-4 w-4" />
                      Open Password Settings
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
          <CardDescription>
            Disable access temporarily or permanently remove the account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>Current handling of profile and activity data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            BookShare stores a mirrored subset of your identity details plus local profile data such as avatar, location, and contact notes.
          </p>
          <p>
            Your app activity stores copies, wishlist entries, and related history needed for library workflows.
          </p>
          <p>
            Deleting your account removes profile and copy details but keeps shared catalog entities.
          </p>
        </CardContent>
      </Card>

      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Account</DialogTitle>
            <DialogDescription>
              Type <span className="font-semibold">DEACTIVATE</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              value={deactivatePassword}
              onChange={(event) => setDeactivatePassword(event.target.value)}
              placeholder="Current password"
            />
            <Input
              value={deactivateConfirmation}
              onChange={(event) => setDeactivateConfirmation(event.target.value)}
              placeholder="Type DEACTIVATE"
            />
            {deactivateAccount.isError ? (
              <p className="text-sm text-destructive">
                {deactivateAccount.error instanceof Error
                  ? deactivateAccount.error.message
                  : "Failed to deactivate account."}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeactivateDialogOpen(false)}
              disabled={deactivateAccount.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmDeactivation}
              disabled={!deactivateReady || deactivateAccount.isPending}
            >
              {deactivateAccount.isPending ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Type <span className="font-semibold">DELETE</span> to confirm permanent account removal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              placeholder="Current password"
            />
            <Input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder="Type DELETE"
            />
            {deleteAccount.isError ? (
              <p className="text-sm text-destructive">
                {deleteAccount.error instanceof Error
                  ? deleteAccount.error.message
                  : "Failed to delete account."}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteAccount.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeletion}
              disabled={!deleteReady || deleteAccount.isPending}
            >
              {deleteAccount.isPending ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
