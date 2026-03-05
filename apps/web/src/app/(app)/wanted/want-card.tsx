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

export function WantCard({ want, onSelect }: WantCardProps) {
  const authors = want.authors?.map((a) => a.name).join(", ");
  const topWanters = want.wanters.slice(0, 3);

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
            <div className="space-y-1 text-sm text-muted-foreground">
              {topWanters.map((wanter) => (
                <p key={wanter.user_id}>
                  @{wanter.username ?? "member"} {wanter.display_name ? `• ${wanter.display_name}` : ""}
                </p>
              ))}
              {want.wanters.length > topWanters.length && (
                <p>+{want.wanters.length - topWanters.length} more</p>
              )}
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
