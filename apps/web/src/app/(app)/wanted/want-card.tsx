import type { PgBrowseWant } from "@/shared/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";

function isStale(lastConfirmedAt: string | null): boolean {
  if (!lastConfirmedAt) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastConfirmedAt).getTime() > thirtyDaysMs;
}

interface WantCardProps {
  want: PgBrowseWant;
  onSelect: (want: PgBrowseWant) => void;
}

export function WantCard({ want, onSelect }: WantCardProps) {
  const stale = isStale(want.last_confirmed_at);
  const authors = want.authors?.map((a) => a.name).join(", ");

  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={() => onSelect(want)}
    >
      <Card
        className={`${stale ? "opacity-60" : ""} cursor-pointer transition-colors hover:bg-accent/50`.trim()}
      >
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

          {want.notes && (
            <p className="text-sm">{want.notes}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {stale && (
              <Badge variant="outline" className="border-amber-600 text-amber-600">
                Stale
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
