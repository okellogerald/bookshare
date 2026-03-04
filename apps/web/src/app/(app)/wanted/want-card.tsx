import Link from "next/link";
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
  quote?: string;
}

export function WantCard({ want, quote }: WantCardProps) {
  const stale = isStale(want.last_confirmed_at);
  const authors = want.authors?.map((a) => a.name).join(", ");

  return (
    <Link href={`/books/${want.book_id}`}>
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

        {quote && (
          <p className="line-clamp-2 text-sm italic text-muted-foreground">
            &ldquo;{quote}&rdquo;
          </p>
        )}

        {want.notes && (
          <p className="text-sm italic">&ldquo;{want.notes}&rdquo;</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {stale && (
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              Stale
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
