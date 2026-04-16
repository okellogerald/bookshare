"use client";

import { cn } from "@/shared/lib/utils";

export interface FlowStepItem {
  step: number;
  label: string;
  current: boolean;
  complete?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export function FlowStepper({ items }: { items: FlowStepItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/70 pb-5">
      {items.map((item, index) => (
        <div key={item.step} className="flex items-center gap-3">
          <button
            type="button"
            onClick={item.onSelect}
            disabled={item.disabled || !item.onSelect}
            className={cn(
              "flex items-center gap-3 rounded-full px-1 py-1 text-sm transition",
              item.disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
              item.current ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold",
                item.current
                  ? "border-primary bg-primary text-primary-foreground"
                  : item.complete
                    ? "border-border/75 bg-muted text-foreground"
                    : "border-border/75 bg-background"
              )}
            >
              {item.step}
            </span>
            <span className={item.current ? "font-medium" : undefined}>{item.label}</span>
          </button>

          {index < items.length - 1 ? (
            <div className="hidden h-px w-8 bg-border sm:block" aria-hidden="true" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
