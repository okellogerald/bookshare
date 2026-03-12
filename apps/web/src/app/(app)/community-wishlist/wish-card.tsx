import type { PgBrowseWant } from "@/shared/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";

interface WantCardProps {
  want: PgBrowseWant;
  canFulfill?: boolean;
  onSelect: (want: PgBrowseWant) => void;
}

function getInitials(value: string): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  const compact = words[0] ?? value.trim();
  if (!compact) return "U";
  return compact.slice(0, 2).toUpperCase();
}

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

export function WishCard({
  want,
  canFulfill = false,
  onSelect,
}: WantCardProps) {
  const authors = want.authors?.map((a) => a.name).join(", ");
  const topWanters = want.wanters.slice(0, 5);
  const remainingWanters = Math.max(want.wanters.length - topWanters.length, 0);
  const isEditionSpecific = !!want.edition_id;
  const editionLabel = isEditionSpecific
    ? `${want.edition_format ? (formatLabels[want.edition_format] ?? want.edition_format) : "Edition"}${
        want.edition_isbn ? ` • ISBN ${want.edition_isbn}` : ""
      }`
    : null;

  return (
    <button type="button" className="w-full text-left" onClick={() => onSelect(want)}>
      <Card className="transition-colors hover:bg-accent/50">
        <div className="overflow-hidden rounded-t-lg border-b bg-gradient-to-b from-muted/40 to-muted/10 p-3">
          <div className="mx-auto aspect-[2/3] h-44 overflow-hidden rounded border bg-background/90 p-2 shadow-sm">
            {want.edition_cover_image_url ? (
              <img
                src={want.edition_cover_image_url}
                alt={want.book_title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                No cover image
              </div>
            )}
          </div>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-base leading-tight">
            {want.book_title}
          </CardTitle>
          {want.book_subtitle && (
            <p className="text-sm text-muted-foreground">{want.book_subtitle}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {authors && (
            <p className="text-sm text-muted-foreground">by {authors}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {want.want_count} {want.want_count === 1 ? "member wishes for this" : "members wish for this"}
            </Badge>
            <Badge variant="outline">
              {isEditionSpecific ? "Edition specific" : "Edition agnostic"}
            </Badge>
            {editionLabel && <Badge variant="outline">{editionLabel}</Badge>}
            {canFulfill && <Badge>You can fulfill</Badge>}
          </div>

          {topWanters.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Interested Members
              </p>
              <div className="flex items-center -space-x-2">
                {topWanters.map((wanter) => {
                  const label =
                    wanter.display_name ||
                    wanter.username ||
                    "Member";
                  return (
                    <div
                      key={wanter.user_id}
                      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground shadow-sm"
                      title={label}
                    >
                      {wanter.avatar_url ? (
                        <img
                          src={wanter.avatar_url}
                          alt={label}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{getInitials(label)}</span>
                      )}
                    </div>
                  );
                })}
                {remainingWanters > 0 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-secondary text-[10px] font-semibold text-secondary-foreground shadow-sm">
                    +{remainingWanters}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </button>
  );
}

export const WantCard = WishCard;
