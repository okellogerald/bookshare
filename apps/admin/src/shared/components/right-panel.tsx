"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const panelSizeClassName = {
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export function RightPanel({
  open,
  onClose,
  title,
  description,
  size = "lg",
  children,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: keyof typeof panelSizeClassName;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative flex h-full w-full flex-col border-l border-border/80 bg-card shadow-[0_28px_80px_rgba(15,23,42,0.22)]",
          panelSizeClassName[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground"
              >
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="rounded-full border border-border/80 bg-background p-2 text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-6", bodyClassName)}>
          {children}
        </div>
      </section>
    </div>
  );
}
