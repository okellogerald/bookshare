"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Info, Loader2 } from "lucide-react";
import { BookstoreStatus } from "@bookshare/shared";
import {
  useBookstore,
  useBookstoreWant,
  useCreateBookstoreProposal,
  useWithdrawBookstoreProposal,
} from "@/domain/bookstores/queries";
import { BookstoreStatusBanner } from "@/shared/components/bookstore-status";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { formatUiDateTime } from "@/shared/lib/date";

export default function BookstoreWantDetailPage() {
  const params = useParams<{ bookstoreId: string; wishId: string }>();
  const bookstoreId = params.bookstoreId;
  const wishId = params.wishId;
  const [proposalMessage, setProposalMessage] = useState("");
  const [proposalOpen, setProposalOpen] = useState(false);

  const bookstoreQuery = useBookstore(bookstoreId);
  const wantQuery = useBookstoreWant(bookstoreId, wishId, {
    enabled: bookstoreQuery.data?.status === BookstoreStatus.APPROVED,
  });
  const createProposal = useCreateBookstoreProposal(bookstoreId);
  const withdrawProposal = useWithdrawBookstoreProposal(bookstoreId, wishId);

  const errorMessage = useMemo(() => {
    return (
      (createProposal.error as Error | null)?.message ||
      (withdrawProposal.error as Error | null)?.message ||
      (wantQuery.error as Error | null)?.message ||
      (bookstoreQuery.error as Error | null)?.message ||
      null
    );
  }, [
    bookstoreQuery.error,
    createProposal.error,
    wantQuery.error,
    withdrawProposal.error,
  ]);

  if (bookstoreQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading bookstore…
      </div>
    );
  }

  if (bookstoreQuery.error || !bookstoreQuery.data) {
    return (
      <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {(bookstoreQuery.error as Error | null)?.message || "Bookstore not found."}
      </div>
    );
  }

  const bookstore = bookstoreQuery.data;

  if (bookstore.status !== BookstoreStatus.APPROVED) {
    return (
      <div className="space-y-4">
        <BookstoreStatusBanner status={bookstore.status} reviewNote={bookstore.reviewNote} />
        <Button asChild variant="outline">
          <Link href={`/orgs/${bookstore.id}/profile`}>Open profile</Link>
        </Button>
      </div>
    );
  }

  if (wantQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading want…
      </div>
    );
  }

  if (wantQuery.error || !wantQuery.data) {
    return (
      <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {(wantQuery.error as Error | null)?.message || "Want not found."}
      </div>
    );
  }

  const want = wantQuery.data;

  async function handleSubmitProposal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createProposal.mutateAsync({
      wishId: want.id,
      message: proposalMessage,
    });
    setProposalMessage("");
    setProposalOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <Link href={`/orgs/${bookstore.id}/wants`} className="hover:underline">
              Active wants
            </Link>{" "}
            / Want detail
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.04em]">
            {want.book.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {want.book.authors.length > 0
              ? want.book.authors.join(", ")
              : "Author not specified"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {want.activeProposal ? (
            <Badge>Proposal active</Badge>
          ) : (
            <Badge variant="secondary">Open</Badge>
          )}
          {!want.activeProposal ? (
            <Button type="button" onClick={() => setProposalOpen(true)}>
              Send proposal
            </Button>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="flex h-56 w-40 shrink-0 items-center justify-center overflow-hidden rounded-[1.2rem] bg-muted">
              {want.book.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={want.book.coverImageUrl}
                  alt={want.book.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-4 text-center text-xs text-muted-foreground">
                  No cover image
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-5">
              <div className="space-y-2">
                <p className="font-display text-xl font-semibold tracking-[-0.03em]">
                  {want.book.title}
                </p>
                {want.book.subtitle ? (
                  <p className="text-sm text-muted-foreground">
                    {want.book.subtitle}
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  {want.book.authors.join(", ") || "Author not specified"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Wanter
                  </p>
                  <p>{want.wanter.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {want.wanter.location || "Location not shared"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Latest activity
                  </p>
                  <p>{formatUiDateTime(want.latestActivityAt)}</p>
                  <p className="text-sm text-muted-foreground">
                    Created {formatUiDateTime(want.createdAt)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Wish notes
                </p>
                <p className="rounded-[1rem] border border-border/75 bg-background/70 px-4 py-3 text-sm">
                  {want.notes || "No wish notes added."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {want.activeProposal ? (
        <Card>
          <CardHeader>
            <CardTitle>Active proposal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sent {formatUiDateTime(want.activeProposal.createdAt)}
            </p>
            <p className="rounded-[1rem] border border-border/75 bg-background/70 px-4 py-3 text-sm">
              {want.activeProposal.message || "No proposal message added."}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => withdrawProposal.mutateAsync(want.activeProposal!.id)}
              disabled={withdrawProposal.isPending}
            >
              {withdrawProposal.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Withdraw proposal
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={proposalOpen} onOpenChange={setProposalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send proposal</DialogTitle>
            <DialogDescription>
              The reader is notified and can open your bookstore contact card.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3 rounded-[1rem] border border-border/75 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              After you send, the wanter can see your bookstore and public contact
              card. Keep the note concise.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmitProposal}>
            <Textarea
              rows={5}
              value={proposalMessage}
              onChange={(event) => setProposalMessage(event.target.value)}
              placeholder="Optional note about stock, expected sourcing time, or next steps."
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProposalOpen(false)}
                disabled={createProposal.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createProposal.isPending}>
                {createProposal.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending proposal
                  </>
                ) : (
                  "Send proposal"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
