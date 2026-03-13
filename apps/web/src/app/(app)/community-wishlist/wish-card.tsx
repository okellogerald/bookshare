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

export function WishCard({
  want,
  canFulfill = false,
  onSelect,
}: WantCardProps) {
  const authors = want.authors?.map((a) => a.name).join(", ");

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
            {canFulfill && <Badge>You can fulfill</Badge>}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export const WantCard = WishCard;
