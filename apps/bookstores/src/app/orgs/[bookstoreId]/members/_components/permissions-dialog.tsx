"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { BOOKSTORE_GRANTABLE_PERMISSIONS } from "@bookshare/shared";
import {
  useGrantMemberPermission,
  useRevokeMemberPermission,
} from "@/domain/bookstores/queries";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  SelectableItem,
  SelectableList,
} from "@/shared/components/ui/selectable-list";

interface PermissionMeta {
  label: string;
  hint: string;
}

const PERMISSION_META: Record<string, PermissionMeta> = {
  "bookstore.update": {
    label: "Update bookstore details",
    hint: "Edit name, contact info, and other profile details.",
  },
  "bookstore.invite.manage": {
    label: "Manage invites",
    hint: "Invite new teammates and revoke pending invites.",
  },
  "bookstore.member.role.manage": {
    label: "Promote and demote members",
    hint: "Switch members between owner and member roles.",
  },
  "bookstore.member.suspend": {
    label: "Suspend members",
    hint: "Temporarily revoke a member's access.",
  },
  "bookstore.member.restore": {
    label: "Restore suspended members",
    hint: "Re-enable previously suspended members.",
  },
  "bookstore.member.remove": {
    label: "Remove members",
    hint: "Permanently remove a member from the bookstore.",
  },
};

function getPermissionMeta(permission: string): PermissionMeta {
  return (
    PERMISSION_META[permission] ?? {
      label: permission,
      hint: "Custom permission grant.",
    }
  );
}

interface PermissionsDialogProps {
  bookstoreId: string;
  open: boolean;
  member: {
    userId: string;
    label: string;
    extraPermissions: string[];
  } | null;
  onOpenChange: (open: boolean) => void;
}

export function PermissionsDialog({
  bookstoreId,
  open,
  member,
  onOpenChange,
}: PermissionsDialogProps) {
  const grant = useGrantMemberPermission(bookstoreId);
  const revoke = useRevokeMemberPermission(bookstoreId);

  const initial = useMemo(
    () => new Set(member?.extraPermissions ?? []),
    [member]
  );
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelected(new Set(member?.extraPermissions ?? []));
    setErrorMessage(null);
  }, [member]);

  const isPending = grant.isPending || revoke.isPending;

  const dirty = useMemo(() => {
    if (!member) return false;
    if (selected.size !== initial.size) return true;
    for (const value of selected) {
      if (!initial.has(value)) return true;
    }
    return false;
  }, [member, selected, initial]);

  function toggle(permission: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permission)) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!member) return;
    setErrorMessage(null);

    const toGrant = Array.from(selected).filter(
      (permission) => !initial.has(permission)
    );
    const toRevoke = Array.from(initial).filter(
      (permission) => !selected.has(permission)
    );

    try {
      for (const permission of toGrant) {
        await grant.mutateAsync({ userId: member.userId, permission });
      }
      for (const permission of toRevoke) {
        await revoke.mutateAsync({ userId: member.userId, permission });
      }
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        (error as Error | null)?.message ?? "Failed to save permissions."
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Permissions for {member?.label ?? "member"}</DialogTitle>
          <DialogDescription>
            Owners already have every permission. Toggle the extras you would
            like this member to have for this bookstore.
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <SelectableList>
          {BOOKSTORE_GRANTABLE_PERMISSIONS.map((permission) => {
            const meta = getPermissionMeta(permission);
            const isSelected = selected.has(permission);
            return (
              <SelectableItem
                key={permission}
                selected={isSelected}
                onClick={() => toggle(permission)}
                disabled={isPending}
              >
                <span className="block font-medium">{meta.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {meta.hint}
                </span>
              </SelectableItem>
            );
          })}
        </SelectableList>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleSave().catch(() => undefined);
            }}
            disabled={!dirty || isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
