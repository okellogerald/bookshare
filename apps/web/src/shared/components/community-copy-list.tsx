"use client";

import type { PgBrowseListing } from "@/shared/api";
import { Badge } from "@/shared/components/ui/badge";

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

const shareTypeLabels: Record<string, string> = {
  lend: "Lend",
  sell: "Sell",
  give_away: "Give Away",
};

const conditionLabels: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

function getMemberName(firstName: string | null, lastName: string | null) {
  const fullName = [firstName, lastName]
    .filter((value): value is string => !!value && value.trim().length > 0)
    .join(" ")
    .trim();
  return fullName || "Community member";
}

function getInitials(firstName: string | null, lastName: string | null) {
  const firstInitial = firstName?.trim().charAt(0) ?? "";
  const lastInitial = lastName?.trim().charAt(0) ?? "";
  const initials = `${firstInitial}${lastInitial}`.toUpperCase();
  return initials || "CM";
}

interface CommunityCopyListProps {
  title?: string;
  listings?: PgBrowseListing[];
  isLoading?: boolean;
  emptyMessage: string;
}

export function CommunityCopyList({
  title,
  listings,
  isLoading = false,
  emptyMessage,
}: CommunityCopyListProps) {
  return (
    <div className="space-y-2">
      {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl border bg-muted/50"
            />
          ))}
        </div>
      ) : listings && listings.length > 0 ? (
        <div className="divide-y rounded-xl border bg-muted/10">
          {listings.map((listing) => (
            <div key={listing.id} className="space-y-1.5 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                    {getInitials(
                      listing.owner_first_name,
                      listing.owner_last_name
                    )}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">
                      {getMemberName(
                        listing.owner_first_name,
                        listing.owner_last_name
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        conditionLabels[listing.condition] ?? listing.condition,
                        formatLabels[listing.format] ?? listing.format,
                        listing.isbn ? `ISBN ${listing.isbn}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                {listing.share_type ? (
                  <Badge variant="secondary" className="shrink-0">
                    {shareTypeLabels[listing.share_type] ?? listing.share_type}
                  </Badge>
                ) : null}
              </div>
              {listing.contact_note ? (
                <p className="pl-12 text-sm text-muted-foreground">
                  {listing.contact_note}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </div>
  );
}
