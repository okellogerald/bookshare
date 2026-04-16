"use client";

import { Badge } from "@/shared/components/ui/badge";
import { formatRole } from "@/domain/team/lib";

export function TeamRoleBadge({
  role,
  onRemove,
  disabled,
}: {
  role: string;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <Badge
      variant="secondary"
      className="gap-2 border border-border/75 bg-background px-3 py-1 text-xs text-foreground"
    >
      <span>{formatRole(role)}</span>
      {onRemove ? (
        <button
          type="button"
          className="rounded-full text-[10px] font-semibold leading-none text-muted-foreground transition hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-300"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${role} role`}
        >
          ×
        </button>
      ) : null}
    </Badge>
  );
}
