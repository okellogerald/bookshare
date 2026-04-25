"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type {
  AdminRequestIdleCopyRow,
  AdminRequestMatchRow,
  AdminRequestUnmetWishRow,
  AdminRequestsSummary,
} from "@bookshare/shared";
import { useRequestsOverview } from "@/domain/requests/queries";
import { PageIntro } from "@/shared/components/page-intro";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";

type Tab = "matches" | "unmet" | "idle";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso)
  );
}

function CoverThumb({
  url,
  title,
}: {
  url: string | null;
  title: string;
}) {
  if (!url) {
    return (
      <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-border/75 bg-muted text-[10px] font-medium text-muted-foreground">
        No cover
      </div>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt={`${title} cover`}
      className="h-14 w-10 shrink-0 rounded-md border border-border/75 bg-muted object-cover shadow-sm"
      loading="lazy"
    />
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/75 bg-card/[0.92]">
      <CardContent className="space-y-1 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function SummaryStrip({ summary }: { summary: AdminRequestsSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="Active wishes" value={summary.activeWishes} />
      <SummaryCard label="Available copies" value={summary.availableCopies} />
      <SummaryCard
        label="Wishes with matches"
        value={summary.wishesWithMatches}
      />
      <SummaryCard label="Idle copies" value={summary.idleCopies} />
    </div>
  );
}

function TabButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-foreground/80 bg-foreground text-background"
          : "border-border/75 bg-background text-muted-foreground hover:text-foreground"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs tabular-nums",
          active
            ? "bg-background/15 text-background"
            : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={6}
        className="py-10 text-center text-sm text-muted-foreground"
      >
        {message}
      </TableCell>
    </TableRow>
  );
}

function MatchesTable({
  rows,
  search,
}: {
  rows: AdminRequestMatchRow[];
  search: string;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.bookTitle,
        row.bookSubtitle ?? "",
        row.wisherDisplayName ?? "",
        row.wisherUserId,
        row.candidates.map((c) => c.ownerDisplayName ?? "").join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[36%]">Wished book</TableHead>
          <TableHead>Wisher</TableHead>
          <TableHead>Wished on</TableHead>
          <TableHead>Candidates</TableHead>
          <TableHead className="w-[28%]">Best candidate</TableHead>
          <TableHead>Edition match</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.length === 0 ? (
          <EmptyRow message="No matches to show. Try clearing the search." />
        ) : (
          filtered.map((row) => {
            const best = row.candidates[0];
            return (
              <TableRow key={row.wishId} className="align-top">
                <TableCell className="whitespace-normal">
                  <div className="flex items-start gap-3">
                    <CoverThumb
                      url={best?.coverImageUrl ?? null}
                      title={row.bookTitle}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {row.bookTitle}
                      </p>
                      {row.bookSubtitle ? (
                        <p className="text-xs text-muted-foreground">
                          {row.bookSubtitle}
                        </p>
                      ) : null}
                      {row.wishEditionIsbn ? (
                        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          Wants ISBN {row.wishEditionIsbn}
                        </p>
                      ) : null}
                      {row.wishNotes ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          “{row.wishNotes}”
                        </p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <p className="font-medium text-foreground">
                    {row.wisherDisplayName ?? "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.wisherUserId}
                  </p>
                </TableCell>
                <TableCell>{formatDate(row.wishCreatedAt)}</TableCell>
                <TableCell className="tabular-nums">
                  {row.candidates.length}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {best ? (
                    <div>
                      <p className="font-medium text-foreground">
                        {best.ownerDisplayName ?? best.ownerUserId}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {best.condition}
                        {best.shareType ? ` · ${best.shareType}` : ""}
                        {" · "}
                        listed {formatDate(best.copyCreatedAt)}
                      </p>
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {row.hasEditionExactCandidate ? (
                    <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      Edition exact
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="border border-border/75 bg-background text-muted-foreground"
                    >
                      Book only
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

function UnmetTable({
  rows,
  search,
}: {
  rows: AdminRequestUnmetWishRow[];
  search: string;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.bookTitle,
        row.bookSubtitle ?? "",
        row.wisherDisplayName ?? "",
        row.wisherUserId,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[44%]">Book</TableHead>
          <TableHead>Wisher</TableHead>
          <TableHead>Wished on</TableHead>
          <TableHead>Wanted edition</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={5}
              className="py-10 text-center text-sm text-muted-foreground"
            >
              Every active wish has at least one candidate copy.
            </TableCell>
          </TableRow>
        ) : (
          filtered.map((row) => (
            <TableRow key={row.wishId} className="align-top">
              <TableCell className="whitespace-normal">
                <p className="font-medium text-foreground">{row.bookTitle}</p>
                {row.bookSubtitle ? (
                  <p className="text-xs text-muted-foreground">
                    {row.bookSubtitle}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="whitespace-normal">
                <p className="font-medium text-foreground">
                  {row.wisherDisplayName ?? "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {row.wisherUserId}
                </p>
              </TableCell>
              <TableCell>{formatDate(row.wishCreatedAt)}</TableCell>
              <TableCell>
                {row.wishEditionIsbn ? `ISBN ${row.wishEditionIsbn}` : "Any"}
              </TableCell>
              <TableCell className="max-w-[320px] whitespace-normal text-sm text-muted-foreground">
                {row.wishNotes ? `“${row.wishNotes}”` : "—"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function IdleTable({
  rows,
  search,
}: {
  rows: AdminRequestIdleCopyRow[];
  search: string;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.bookTitle,
        row.bookSubtitle ?? "",
        row.ownerDisplayName ?? "",
        row.ownerUserId,
        row.isbn ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">Copy</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Listed on</TableHead>
          <TableHead>Condition</TableHead>
          <TableHead>Share type</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={5}
              className="py-10 text-center text-sm text-muted-foreground"
            >
              Every available copy is wished for by someone right now.
            </TableCell>
          </TableRow>
        ) : (
          filtered.map((row) => (
            <TableRow key={row.copyId} className="align-top">
              <TableCell className="whitespace-normal">
                <div className="flex items-start gap-3">
                  <CoverThumb url={row.coverImageUrl} title={row.bookTitle} />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {row.bookTitle}
                    </p>
                    {row.bookSubtitle ? (
                      <p className="text-xs text-muted-foreground">
                        {row.bookSubtitle}
                      </p>
                    ) : null}
                    {row.isbn ? (
                      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        ISBN {row.isbn}
                      </p>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className="whitespace-normal">
                <p className="font-medium text-foreground">
                  {row.ownerDisplayName ?? "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {row.ownerUserId}
                </p>
              </TableCell>
              <TableCell>{formatDate(row.copyCreatedAt)}</TableCell>
              <TableCell>{row.condition}</TableCell>
              <TableCell>{row.shareType ?? "—"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function RequestsWorkspace() {
  const overviewQuery = useRequestsOverview();
  const [tab, setTab] = useState<Tab>("matches");
  const [search, setSearch] = useState("");

  const overview = overviewQuery.data;

  const tabCounts = useMemo(
    () => ({
      matches: overview?.matches.length ?? 0,
      unmet: overview?.unmet.length ?? 0,
      idle: overview?.idle.length ?? 0,
    }),
    [overview]
  );

  return (
    <section className="space-y-8">
      <PageIntro
        title="Matches"
        description="Connect active wishes to currently available copies. Edition-exact candidates are flagged so you can spot the strongest fits at a glance."
      />

      {overviewQuery.isLoading ? (
        <Card className="border-border/75 bg-card/[0.92]">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading matches…
          </CardContent>
        </Card>
      ) : overviewQuery.isError ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="space-y-1 p-6">
            <p className="text-sm font-medium text-destructive">
              Couldn&apos;t load matches.
            </p>
            <p className="text-xs text-muted-foreground">
              {overviewQuery.error instanceof Error
                ? overviewQuery.error.message
                : "Try refreshing the page."}
            </p>
          </CardContent>
        </Card>
      ) : overview ? (
        <>
          <SummaryStrip summary={overview.summary} />

          <Card className="border-border/75 bg-card/[0.92]">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <TabButton
                    active={tab === "matches"}
                    count={tabCounts.matches}
                    label="Matches"
                    onClick={() => setTab("matches")}
                  />
                  <TabButton
                    active={tab === "unmet"}
                    count={tabCounts.unmet}
                    label="Unmet wishes"
                    onClick={() => setTab("unmet")}
                  />
                  <TabButton
                    active={tab === "idle"}
                    count={tabCounts.idle}
                    label="Idle copies"
                    onClick={() => setTab("idle")}
                  />
                </div>
                <div className="w-full max-w-xs">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by book, member, or ISBN"
                  />
                </div>
              </div>

              {tab === "matches" ? (
                <MatchesTable rows={overview.matches} search={search} />
              ) : tab === "unmet" ? (
                <UnmetTable rows={overview.unmet} search={search} />
              ) : (
                <IdleTable rows={overview.idle} search={search} />
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}
