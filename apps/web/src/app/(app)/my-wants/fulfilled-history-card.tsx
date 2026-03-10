import type { PgFulfilledWantHistory } from "@/shared/api";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";

interface FulfilledHistoryCardProps {
  entry: PgFulfilledWantHistory;
  perspective: "received" | "given";
  onOpenDetails: (entry: PgFulfilledWantHistory) => void;
}

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

const fulfillmentTypeLabels: Record<string, string> = {
  lent: "Lent",
  sold: "Sold",
  given_away: "Given Away",
};

function formatEdition(entry: PgFulfilledWantHistory) {
  const format = entry.fulfilled_edition_format ?? entry.wanted_edition_format;
  const isbn = entry.fulfilled_edition_isbn ?? entry.wanted_edition_isbn;
  const formatLabel = format ? (formatLabels[format] ?? format) : "Edition";
  return isbn ? `${formatLabel} • ISBN ${isbn}` : formatLabel;
}

function formatWantedPreference(entry: PgFulfilledWantHistory) {
  if (!entry.wanted_edition_id) return "Any edition";
  const format = entry.wanted_edition_format;
  const isbn = entry.wanted_edition_isbn;
  const formatLabel = format ? (formatLabels[format] ?? format) : "Specific edition";
  return isbn ? `${formatLabel} • ISBN ${isbn}` : formatLabel;
}

function getCover(entry: PgFulfilledWantHistory) {
  return (
    entry.fulfilled_edition_cover_image_url ??
    entry.wanted_edition_cover_image_url ??
    null
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export function FulfilledHistoryCard({
  entry,
  perspective,
  onOpenDetails,
}: FulfilledHistoryCardProps) {
  const cover = getCover(entry);
  const whoLabel = perspective === "received" ? "Given by" : "Given to";
  const whoValue =
    perspective === "received"
      ? entry.fulfiller_display_name ?? entry.fulfiller_username ?? "Member"
      : entry.recipient_display_name ?? entry.recipient_username ?? "Member";
  const notesLabel =
    perspective === "received" ? "Your want note" : "Wanter note";
  const editionLabel = perspective === "received" ? "Received edition" : "Shared edition";

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-24 w-16 shrink-0 overflow-hidden rounded border bg-muted">
            {cover ? (
              <img
                src={cover}
                alt={entry.book_title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                No cover
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="line-clamp-2 text-base">{entry.book_title}</CardTitle>
            {entry.book_subtitle && (
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {entry.book_subtitle}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="secondary">
                {entry.fulfillment_type
                  ? (fulfillmentTypeLabels[entry.fulfillment_type] ??
                    entry.fulfillment_type)
                  : "Fulfilled"}
              </Badge>
              <Badge variant="outline">
                {entry.wanted_edition_id ? "Edition specific request" : "Edition agnostic request"}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="font-medium">{whoLabel}:</span> {whoValue}
        </p>
        <p>
          <span className="font-medium">{notesLabel}:</span>{" "}
          {entry.wanter_notes || "No note provided."}
        </p>
        <p>
          <span className="font-medium">Wanter preference:</span>{" "}
          {formatWantedPreference(entry)}
        </p>
        <p>
          <span className="font-medium">{editionLabel}:</span>{" "}
          {formatEdition(entry)}
        </p>
        {entry.fulfillment_notes && (
          <p>
            <span className="font-medium">Recorded note:</span>{" "}
            {entry.fulfillment_notes}
          </p>
        )}
        <p className="text-muted-foreground">
          {perspective === "received" ? "Received on" : "Recorded on"}{" "}
          {formatDate(entry.fulfillment_recorded_at ?? entry.fulfilled_at)}
        </p>
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenDetails(entry)}
          >
            View Book Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
