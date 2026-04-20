import { AlertTriangle, Clock3, ShieldCheck, ShieldOff } from "lucide-react";
import { BookstoreStatus } from "@bookshare/shared";
import { Badge } from "@/shared/components/ui/badge";
import {
  getBookstoreStatusLabel,
  getBookstoreStatusTone,
} from "@/shared/lib/bookstores";

function getStatusIcon(status: BookstoreStatus) {
  switch (status) {
    case BookstoreStatus.APPROVED:
      return ShieldCheck;
    case BookstoreStatus.PENDING:
      return Clock3;
    case BookstoreStatus.REJECTED:
      return AlertTriangle;
    case BookstoreStatus.SUSPENDED:
      return ShieldOff;
    default:
      return Clock3;
  }
}

function getStatusMessage(status: BookstoreStatus) {
  switch (status) {
    case BookstoreStatus.APPROVED:
      return "This bookstore can browse active wants, invite members, and send proposals.";
    case BookstoreStatus.PENDING:
      return "This bookstore is waiting for manual review in the admin dashboard.";
    case BookstoreStatus.REJECTED:
      return "This bookstore needs changes before it can operate again.";
    case BookstoreStatus.SUSPENDED:
      return "This bookstore is suspended and cannot browse wants, invite members, or send proposals.";
    default:
      return null;
  }
}

export function BookstoreStatusBadge({
  status,
}: {
  status: BookstoreStatus;
}) {
  return (
    <Badge variant={getBookstoreStatusTone(status)}>
      {getBookstoreStatusLabel(status)}
    </Badge>
  );
}

export function BookstoreStatusBanner({
  status,
  reviewNote,
}: {
  status: BookstoreStatus;
  reviewNote?: string | null;
}) {
  const Icon = getStatusIcon(status);
  const message = getStatusMessage(status);

  return (
    <div className="rounded-[1.4rem] border border-border/75 bg-card/80 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-muted p-2">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-sm font-semibold tracking-[-0.025em]">
              {getBookstoreStatusLabel(status)}
            </p>
            <BookstoreStatusBadge status={status} />
          </div>
          {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}
          {reviewNote ? (
            <p className="text-sm text-foreground/80">
              Review note: {reviewNote}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
