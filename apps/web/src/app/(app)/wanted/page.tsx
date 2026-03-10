"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PgBrowseWant } from "@/shared/api";
import { BookDetailsDialog } from "@/shared/components/book-details-dialog";
import { PaginationControls } from "@/shared/components/pagination-controls";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { useCurrentUser } from "@/shared/providers/user-provider";
import {
  useMyCopies,
  useUpdateCopyStatus,
} from "@/shared/queries/my-library";
import { useBrowseWants } from "@/shared/queries/wanted";
import { WantCard } from "./want-card";

const pageSize = 24;

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

function getWantKey(want: PgBrowseWant) {
  return `${want.book_id}:${want.edition_id ?? "any"}`;
}

export default function WantedPage() {
  const currentUser = useCurrentUser();
  const isAuthenticated = !!currentUser;
  const [search, setSearch] = useState("");
  const [includeMyWants, setIncludeMyWants] = useState(false);
  const [showFulfillableOnly, setShowFulfillableOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedWantKey, setSelectedWantKey] = useState<string | null>(null);
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [fulfillWant, setFulfillWant] = useState<PgBrowseWant | null>(null);
  const [selectedCopyId, setSelectedCopyId] = useState("");
  const [selectedWanterId, setSelectedWanterId] = useState("");
  const [fulfillStatus, setFulfillStatus] = useState<"lent" | "sold" | "given_away">("lent");
  const [fulfillNotes, setFulfillNotes] = useState("");

  const { data: wants, isLoading } = useBrowseWants({ search });
  const { data: myCopies } = useMyCopies({ enabled: isAuthenticated });
  const updateCopyStatus = useUpdateCopyStatus();

  const availableCopies = useMemo(
    () => (myCopies ?? []).filter((copy) => copy.status === "available"),
    [myCopies]
  );

  const matchingCopiesByWantKey = useMemo(() => {
    const map = new Map<string, typeof availableCopies>();
    for (const want of wants ?? []) {
      const matching =
        want.edition_id
          ? availableCopies.filter((copy) => copy.edition_id === want.edition_id)
          : availableCopies.filter(
              (copy) => copy.edition?.book?.id === want.book_id
            );
      map.set(getWantKey(want), matching);
    }
    return map;
  }, [availableCopies, wants]);

  const filteredWants = useMemo(() => {
    if (!wants) return [];
    return wants.filter((want) => {
      const hasSelfAsWanter =
        !!currentUser?.id &&
        want.wanters.some((wanter) => wanter.user_id === currentUser.id);
      if (!includeMyWants && hasSelfAsWanter) return false;

      if (!showFulfillableOnly) return true;
      const hasEligibleWanter = want.wanters.some(
        (wanter) => wanter.user_id !== currentUser?.id
      );
      const matchingCopies = matchingCopiesByWantKey.get(getWantKey(want)) ?? [];
      return hasEligibleWanter && matchingCopies.length > 0;
    });
  }, [
    currentUser?.id,
    includeMyWants,
    matchingCopiesByWantKey,
    showFulfillableOnly,
    wants,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredWants.length / pageSize));
  const pagedWants = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredWants.slice(start, start + pageSize);
  }, [filteredWants, page]);

  useEffect(() => {
    setPage(1);
  }, [search, includeMyWants, showFulfillableOnly]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const selectedWantFromFiltered = selectedWantKey
    ? filteredWants.find((want) => getWantKey(want) === selectedWantKey) ?? null
    : null;
  const selectedBookWantVariants = useMemo(() => {
    if (!selectedWantFromFiltered) return [];
    return filteredWants.filter(
      (want) => want.book_id === selectedWantFromFiltered.book_id
    );
  }, [filteredWants, selectedWantFromFiltered]);
  const selectedBookPreferenceSummary = useMemo(() => {
    let editionAgnostic = 0;
    let editionSpecific = 0;
    const specificEditionIds = new Set<string>();

    for (const want of selectedBookWantVariants) {
      if (want.edition_id) {
        editionSpecific += want.want_count;
        specificEditionIds.add(want.edition_id);
      } else {
        editionAgnostic += want.want_count;
      }
    }

    return {
      editionAgnostic,
      editionSpecific,
      specificEditionCount: specificEditionIds.size,
    };
  }, [selectedBookWantVariants]);

  useEffect(() => {
    if (detailsOpen && selectedWantKey && !selectedWantFromFiltered) {
      setDetailsOpen(false);
      setSelectedWantKey(null);
    }
  }, [detailsOpen, selectedWantKey, selectedWantFromFiltered]);

  const fulfillMatchingCopies = useMemo(() => {
    if (!fulfillWant) return [];
    return matchingCopiesByWantKey.get(getWantKey(fulfillWant)) ?? [];
  }, [fulfillWant, matchingCopiesByWantKey]);

  const fulfillEligibleWanters = useMemo(
    () =>
      (fulfillWant?.wanters ?? []).filter(
        (wanter) => wanter.user_id !== currentUser?.id
      ),
    [currentUser?.id, fulfillWant?.wanters]
  );

  useEffect(() => {
    if (!fulfillOpen || !fulfillWant) return;
    setSelectedCopyId(fulfillMatchingCopies[0]?.id ?? "");
    setSelectedWanterId(fulfillEligibleWanters[0]?.user_id ?? "");
    setFulfillStatus("lent");
    setFulfillNotes("");
  }, [fulfillEligibleWanters, fulfillMatchingCopies, fulfillOpen, fulfillWant]);

  function handleWantSelect(want: PgBrowseWant) {
    setSelectedWantKey(getWantKey(want));
    setDetailsOpen(true);
  }

  function canFulfill(want: PgBrowseWant) {
    if (!isAuthenticated) return false;
    const hasEligibleWanter = want.wanters.some(
      (wanter) => wanter.user_id !== currentUser?.id
    );
    const matchingCopies = matchingCopiesByWantKey.get(getWantKey(want)) ?? [];
    return hasEligibleWanter && matchingCopies.length > 0;
  }

  function submitFulfill() {
    if (!selectedCopyId || !selectedWanterId) return;
    updateCopyStatus.mutate(
      {
        id: selectedCopyId,
        body: {
          status: fulfillStatus,
          counterpartyType: "member",
          counterpartyUserId: selectedWanterId,
          notes: fulfillNotes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setFulfillOpen(false);
          setFulfillWant(null);
          setSelectedCopyId("");
          setSelectedWanterId("");
          setFulfillNotes("");
        },
      }
    );
  }

  function openRecordExchangeFromDetails() {
    if (!selectedWantFromFiltered) return;
    setDetailsOpen(false);
    setFulfillWant(selectedWantFromFiltered);
    setFulfillOpen(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wanted</h1>
        <p className="text-muted-foreground">
          Books that community members are looking for
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by book title..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        {isAuthenticated ? (
          <>
            <Button
              type="button"
              variant={includeMyWants ? "default" : "outline"}
              onClick={() => setIncludeMyWants((current) => !current)}
            >
              {includeMyWants ? "Hide My Wants" : "Show My Wants"}
            </Button>
            <Button
              type="button"
              variant={showFulfillableOnly ? "default" : "outline"}
              onClick={() => setShowFulfillableOnly((current) => !current)}
            >
              {showFulfillableOnly
                ? "Show All Wants"
                : "Show Wants I Can Fulfill"}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" asChild>
            <Link href="/api/auth/login?returnTo=/wanted">
              Sign In to Fulfill Wants
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !filteredWants.length ? (
        <p className="text-muted-foreground">No wanted books found.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pagedWants.map((want) => (
              <WantCard
                key={getWantKey(want)}
                want={want}
                canFulfill={canFulfill(want)}
                onSelect={handleWantSelect}
              />
            ))}
          </div>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={filteredWants.length}
            onPageChange={setPage}
          />
        </>
      )}

      <BookDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        bookId={selectedWantFromFiltered?.book_id ?? null}
        fallbackTitle={selectedWantFromFiltered?.book_title}
        fallbackSubtitle={selectedWantFromFiltered?.book_subtitle}
        preferredImageUrl={selectedWantFromFiltered?.edition_cover_image_url}
      >
        {selectedWantFromFiltered && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Community wanters ({selectedWantFromFiltered.want_count})
              </p>
              <Badge variant="outline">
                {selectedWantFromFiltered.edition_id
                  ? "Edition specific"
                  : "Edition agnostic"}
              </Badge>
              <Badge variant="outline">
                {selectedWantFromFiltered.edition_id
                  ? `${selectedWantFromFiltered.edition_format ? (formatLabels[selectedWantFromFiltered.edition_format] ?? selectedWantFromFiltered.edition_format) : "Edition"}${
                      selectedWantFromFiltered.edition_isbn
                        ? ` • ISBN ${selectedWantFromFiltered.edition_isbn}`
                        : ""
                    }`
                  : "Any edition"}
              </Badge>
            </div>
            {(selectedBookPreferenceSummary.editionAgnostic > 0 ||
              selectedBookPreferenceSummary.editionSpecific > 0) && (
              <div className="rounded border bg-muted/30 p-2 text-sm text-muted-foreground">
                Preference mix for this book:{" "}
                <span className="font-medium text-foreground">
                  {selectedBookPreferenceSummary.editionAgnostic}
                </span>{" "}
                edition-agnostic,{" "}
                <span className="font-medium text-foreground">
                  {selectedBookPreferenceSummary.editionSpecific}
                </span>{" "}
                edition-specific
                {selectedBookPreferenceSummary.editionSpecific > 0
                  ? ` across ${selectedBookPreferenceSummary.specificEditionCount} edition${selectedBookPreferenceSummary.specificEditionCount === 1 ? "" : "s"}`
                  : ""}
                .
              </div>
            )}
            <div className="rounded border bg-muted/30 p-2 text-sm text-muted-foreground">
              Exchange is handled outside the app. Contact a member first, then record the completed exchange here.
            </div>
            <div className="space-y-2">
              {selectedWantFromFiltered.wanters.map((wanter) => (
                <div key={wanter.user_id} className="rounded border p-2">
                  <p className="text-sm font-medium">
                    @{wanter.username ?? "member"}
                    {wanter.display_name ? ` • ${wanter.display_name}` : ""}
                  </p>
                  {wanter.notes ? (
                    <p className="text-sm text-muted-foreground">{wanter.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No note provided.</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-dashed p-2">
              <p className="text-sm text-muted-foreground">
                After completing the exchange, record what happened with the specific edition copy.
              </p>
              {isAuthenticated ? (
                <Button
                  type="button"
                  onClick={openRecordExchangeFromDetails}
                  disabled={!canFulfill(selectedWantFromFiltered)}
                >
                  Record Exchange
                </Button>
              ) : (
                <Button type="button" asChild>
                  <Link href="/api/auth/login?returnTo=/wanted">Sign In</Link>
                </Button>
              )}
            </div>
            {isAuthenticated && !canFulfill(selectedWantFromFiltered) && (
              <p className="text-xs text-muted-foreground">
                You need an available matching copy and at least one other member wanting this edition/book.
              </p>
            )}
          </div>
        )}
      </BookDetailsDialog>

      <Dialog open={fulfillOpen} onOpenChange={setFulfillOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Exchange</DialogTitle>
            <DialogDescription>
              Use this after you have already exchanged the book offline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {fulfillWant && (
              <div className="rounded border bg-muted/30 p-2 text-sm text-muted-foreground">
                Recording exchange for{" "}
                <span className="font-medium text-foreground">
                  {fulfillWant.book_title}
                </span>{" "}
                (
                {fulfillWant.edition_id
                  ? fulfillWant.edition_isbn
                    ? `ISBN ${fulfillWant.edition_isbn}`
                    : "Specific edition"
                  : "Any edition"}
                ). Select the exact copy/edition you exchanged.
              </div>
            )}
            <div className="space-y-2">
              <Label>Copy</Label>
              <Select value={selectedCopyId} onValueChange={setSelectedCopyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your available copy" />
                </SelectTrigger>
                <SelectContent>
                  {fulfillMatchingCopies.map((copy) => (
                    <SelectItem key={copy.id} value={copy.id}>
                      {copy.edition?.book?.title ?? "Book"} •{" "}
                      {copy.edition?.format
                        ? (formatLabels[copy.edition.format] ?? copy.edition.format)
                        : "Unknown format"}
                      {copy.edition?.isbn ? ` • ISBN ${copy.edition.isbn}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Member</Label>
              <Select value={selectedWanterId} onValueChange={setSelectedWanterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {fulfillEligibleWanters.map((wanter) => (
                    <SelectItem key={wanter.user_id} value={wanter.user_id}>
                      @{wanter.username ?? "member"}
                      {wanter.display_name ? ` • ${wanter.display_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={fulfillStatus}
                onValueChange={(value) =>
                  setFulfillStatus(value as "lent" | "sold" | "given_away")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lent">Lend</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="given_away">Give Away</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={fulfillNotes}
                onChange={(event) => setFulfillNotes(event.target.value)}
                placeholder="Optional note for this status update"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFulfillOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitFulfill}
              disabled={
                !selectedCopyId ||
                !selectedWanterId ||
                updateCopyStatus.isPending
              }
            >
              {updateCopyStatus.isPending ? "Saving..." : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
