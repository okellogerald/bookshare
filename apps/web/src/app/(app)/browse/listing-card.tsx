import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import type { PgBrowseListing } from "@/shared/api";

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

function isStale(lastConfirmedAt: string | null): boolean {
  if (!lastConfirmedAt) return true;
  const confirmed = new Date(lastConfirmedAt);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return confirmed < thirtyDaysAgo;
}

interface ListingCardProps {
  listing: PgBrowseListing;
  onSelect: (listing: PgBrowseListing) => void;
}

export function ListingCard({ listing, onSelect }: ListingCardProps) {
  const authors = listing.authors
    .map((a) => a.name)
    .join(", ");
  const stale = isStale(listing.last_confirmed_at);

  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={() => onSelect(listing)}
    >
      <Card className="cursor-pointer transition-colors hover:bg-accent/50">
        {listing.primary_image_url && (
          <div className="overflow-hidden rounded-t-lg border-b">
            <img
              src={listing.primary_image_url}
              alt={listing.book_title}
              className="h-36 w-full object-cover"
            />
          </div>
        )}
        <CardHeader className="pb-3">
          <CardTitle className="line-clamp-2 text-base">
            {listing.book_title}
          </CardTitle>
          {authors && (
            <p className="text-sm text-muted-foreground">{authors}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {listing.share_type && (
              <Badge variant="default">
                {shareTypeLabels[listing.share_type] ?? listing.share_type}
              </Badge>
            )}
            <Badge variant="secondary">
              {conditionLabels[listing.condition] ?? listing.condition}
            </Badge>
            <Badge variant="outline">{listing.format}</Badge>
          </div>

          {listing.isbn && (
            <p className="text-xs text-muted-foreground">
              ISBN: {listing.isbn}
            </p>
          )}

          {listing.contact_note && (
            <p className="text-sm">{listing.contact_note}</p>
          )}

          <p className="text-xs text-muted-foreground">
            Listed by @{listing.owner_username ?? "member"}
            {listing.owner_display_name
              ? ` • ${listing.owner_display_name}`
              : ""}
          </p>

          {listing.status === "lent" && (
            <p className="text-xs text-muted-foreground">
              Borrowed by @{listing.borrower_username ?? "member"} from @
              {listing.owner_username ?? "member"}
            </p>
          )}

          {listing.location && (
            <p className="text-xs text-muted-foreground">
              Location: {listing.location}
            </p>
          )}

          {stale && (
            <p className="text-xs text-destructive">
              Not confirmed recently
            </p>
          )}
        </CardContent>
      </Card>
    </button>
  );
}
