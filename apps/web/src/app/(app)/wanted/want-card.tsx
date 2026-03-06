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

export function WantCard({ want, onSelect }: WantCardProps) {
  const authors = want.authors?.map((a) => a.name).join(", ");
  const topWanters = want.wanters.slice(0, 5);
  const remainingWanters = Math.max(want.wanters.length - topWanters.length, 0);

  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={() => onSelect(want)}
    >
      <Card className="cursor-pointer transition-colors hover:bg-accent/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base leading-tight">
            {want.book_title}
          </CardTitle>
          {want.book_subtitle && (
            <p className="text-sm text-muted-foreground">{want.book_subtitle}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {authors && (
            <p className="text-sm text-muted-foreground">by {authors}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {want.want_count} {want.want_count === 1 ? "member wants this" : "members want this"}
            </Badge>
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

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Open details</Badge>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
