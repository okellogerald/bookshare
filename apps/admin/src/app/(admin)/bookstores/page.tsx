"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookstoreStatus,
  type AdminBookstoreSummary,
} from "@bookshare/shared";
import { Loader2, Plus } from "lucide-react";
import { useAdminFlow } from "@/flows/admin-flow-provider";
import { useAdminBookstores } from "@/domain/bookstores/queries";
import { PageIntro } from "@/shared/components/page-intro";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

function formatUiDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStatusLabel(status: BookstoreStatus) {
  switch (status) {
    case BookstoreStatus.PENDING:
      return "Pending review";
    case BookstoreStatus.APPROVED:
      return "Approved";
    case BookstoreStatus.REJECTED:
      return "Rejected";
    case BookstoreStatus.SUSPENDED:
      return "Suspended";
    default:
      return status;
  }
}

function getStatusVariant(status: BookstoreStatus) {
  switch (status) {
    case BookstoreStatus.APPROVED:
      return "default" as const;
    case BookstoreStatus.PENDING:
      return "secondary" as const;
    case BookstoreStatus.REJECTED:
    case BookstoreStatus.SUSPENDED:
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

function buildContactLine(bookstore: AdminBookstoreSummary) {
  return (
    bookstore.websiteUrl?.replace(/^https?:\/\//, "") ||
    bookstore.email ||
    bookstore.phone ||
    null
  );
}

export default function AdminBookstoresPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [status, setStatus] = useState<"all" | BookstoreStatus>(
    (searchParams.get("status") as "all" | BookstoreStatus | null) ?? "all"
  );
  const { openFlow } = useAdminFlow();

  const bookstoresQuery = useAdminBookstores({ status, query });

  function updateSearchParams(next: { query?: string; status?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.query !== undefined) {
      if (next.query.trim()) {
        params.set("query", next.query.trim());
      } else {
        params.delete("query");
      }
    }

    if (next.status !== undefined) {
      if (next.status && next.status !== "all") {
        params.set("status", next.status);
      } else {
        params.delete("status");
      }
    }

    const serialized = params.toString();
    router.replace(serialized ? `${pathname}?${serialized}` : pathname);
  }

  const errorMessage = useMemo(() => {
    return (bookstoresQuery.error as Error | null)?.message ?? null;
  }, [bookstoresQuery.error]);

  const rows = bookstoresQuery.data ?? [];

  return (
    <section className="space-y-6">
      <PageIntro
        title="Bookstores"
        description="Review bookstore organizations, inspect owners and contacts, and control their approval lifecycle."
        actions={
          <Button
            type="button"
            className="rounded-full px-4"
            onClick={() => openFlow({ kind: "create-bookstore" })}
          >
            <Plus className="h-4 w-4" />
            Create bookstore
          </Button>
        }
      />

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <Input
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            updateSearchParams({ query: next });
          }}
          placeholder="Search name, email, phone, Instagram, or website"
        />
        <Select
          value={status}
          onChange={(event) => {
            const next = event.target.value as "all" | BookstoreStatus;
            setStatus(next);
            updateSearchParams({ status: next });
          }}
        >
          <option value="all">All statuses</option>
          <option value={BookstoreStatus.PENDING}>Pending</option>
          <option value={BookstoreStatus.APPROVED}>Approved</option>
          <option value={BookstoreStatus.REJECTED}>Rejected</option>
          <option value={BookstoreStatus.SUSPENDED}>Suspended</option>
        </Select>
      </div>

      {bookstoresQuery.isLoading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading bookstores…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No bookstores match this view.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owners</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Proposals (30d)</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((bookstore) => {
                const contactLine = buildContactLine(bookstore);
                return (
                  <TableRow
                    key={bookstore.id}
                    className="cursor-pointer transition hover:bg-muted/50"
                    onClick={() =>
                      router.push(`/bookstores/${bookstore.id}`)
                    }
                  >
                    <TableCell className="min-w-[220px] whitespace-normal">
                      <p className="font-medium text-foreground">
                        {bookstore.name}
                      </p>
                      {contactLine ? (
                        <p className="text-xs text-muted-foreground">
                          {contactLine}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(bookstore.status)}>
                        {getStatusLabel(bookstore.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] whitespace-normal text-sm text-muted-foreground">
                      {bookstore.ownerNames.length > 0
                        ? bookstore.ownerNames.join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {bookstore.memberCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {bookstore.recentProposalCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatUiDate(bookstore.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
