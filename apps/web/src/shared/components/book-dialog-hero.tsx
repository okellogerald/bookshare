"use client";

import type { ReactNode } from "react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

interface BookDialogHeroProps {
  title: string;
  subtitle?: string | null;
  authors?: string | null;
  imageUrl?: string | null;
  children?: ReactNode;
}

export function BookDialogHero({
  title,
  subtitle,
  authors,
  imageUrl,
  children,
}: BookDialogHeroProps) {
  return (
    <>
      {imageUrl ? (
        <div className="mx-auto w-full max-w-[170px] sm:max-w-[210px]">
          <div className="aspect-[2/3] overflow-hidden rounded-md border bg-muted/30 p-2 shadow-sm">
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[170px] sm:max-w-[210px]">
          <div className="flex aspect-[2/3] items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
            No cover image available
          </div>
        </div>
      )}

      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
      </DialogHeader>

      <div className="space-y-3">
        {authors ? (
          <p className="text-sm text-muted-foreground">By {authors}</p>
        ) : null}
        {children}
      </div>
    </>
  );
}
