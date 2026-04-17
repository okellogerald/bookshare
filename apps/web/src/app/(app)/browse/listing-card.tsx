import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import type { BrowseEditionListing } from "@/domains/browse/queries";

const shareTypeLabels: Record<string, string> = {
  lend: "Lend",
  sell: "Sell",
  give_away: "Give Away",
};

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

function isStale(lastConfirmedAt: string | null): boolean {
  if (!lastConfirmedAt) return true;
  const confirmed = new Date(lastConfirmedAt);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return confirmed < thirtyDaysAgo;
}

interface ListingCardProps {
  listing: BrowseEditionListing;
  onSelect: (listing: BrowseEditionListing) => void;
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
        <div className="overflow-hidden rounded-t-lg border-b bg-gradient-to-b from-muted/40 to-muted/10 p-3">
          <div className="mx-auto aspect-[2/3] h-44 overflow-hidden rounded border bg-background/90 p-2 shadow-sm">
            {listing.cover_image_url ? (
              <img
                src={listing.cover_image_url}
                alt={listing.book_title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                No cover image
              </div>
            )}
          </div>
        </div>
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
            {listing.share_types.map((shareType) => (
              <Badge key={shareType} variant="default">
                {shareTypeLabels[shareType] ?? shareType}
              </Badge>
            ))}
            <Badge variant="outline">
              {formatLabels[listing.format] ?? listing.format}
            </Badge>
            <Badge variant="secondary">
              {listing.copy_count} {listing.copy_count === 1 ? "copy" : "copies"}
            </Badge>
            {listing.book_edition_count > 1 && (
              <Badge variant="secondary">
                {listing.book_edition_count} editions
              </Badge>
            )}
          </div>
          {listing.publisher || listing.published_year ? (
            <p className="text-xs text-muted-foreground">
              {[listing.publisher, listing.published_year]
                .filter(Boolean)
                .join(" • ")}
            </p>
          ) : null}

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
