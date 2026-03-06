"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal } from "lucide-react";
import { BookDetailsDialog } from "@/shared/components/book-details-dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useCurrentUser } from "@/shared/providers/user-provider";
import {
  useMyCopies,
  useConfirmCopy,
  useUpdateCopyStatus,
  useDeleteCopy,
} from "@/shared/queries/my-library";
import { useCommunityMembers } from "@/shared/queries/community";

const statusLabels: Record<string, string> = {
  available: "Available",
  reserved: "Reserved",
  lent: "Lent Out",
  rented: "Rented",
  checked_out: "Checked Out",
  sold: "Sold",
  donated: "Donated",
  given_away: "Given Away",
  lost: "Lost",
  damaged: "Damaged",
};

const shareTypeLabels: Record<string, string> = {
  lend: "Lend",
  sell: "Sell",
  give_away: "Give Away",
};

export default function MyLibraryPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<{
    id: string;
    title?: string;
    subtitle?: string | null;
    preferredImageUrl?: string | null;
  } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{
    copyId: string;
    status: "lent" | "sold" | "given_away";
  } | null>(null);
  const [counterpartyUserId, setCounterpartyUserId] = useState("");

  const { data: copies, isLoading } = useMyCopies();
  const { data: members } = useCommunityMembers();
  const currentUser = useCurrentUser();
  const confirmMutation = useConfirmCopy();
  const statusMutation = useUpdateCopyStatus();
  const deleteMutation = useDeleteCopy();
  const memberNameById = useMemo(
    () =>
      new Map(
        (members ?? []).map((member) => [
          member.user_id,
          `@${member.username}${member.display_name ? ` (${member.display_name})` : ""}`,
        ])
      ),
    [members]
  );

  function handleOpenBookDetails(copy: NonNullable<typeof copies>[number]) {
    const book = copy.edition?.book;
    if (!book?.id) return;
    setSelectedBook({
      id: book.id,
      title: book.title,
      subtitle: book.subtitle,
      preferredImageUrl:
        copy.edition?.cover_image_url ??
        copy.images?.[0]?.image_url ??
        null,
    });
    setDialogOpen(true);
  }

  function openStatusDialog(
    copyId: string,
    status: "lent" | "sold" | "given_away"
  ) {
    setCounterpartyUserId("");
    setStatusDialog({ copyId, status });
  }

  function submitStatusDialog() {
    if (!statusDialog || !counterpartyUserId) return;
    statusMutation.mutate({
      id: statusDialog.copyId,
      body: {
        status: statusDialog.status,
        counterpartyUserId,
      },
    });
    setStatusDialog(null);
    setCounterpartyUserId("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Library</h1>
          <p className="text-muted-foreground">
            Manage your book copies and listings
          </p>
        </div>
        <Link href="/my-library/add">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Copy
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : copies && copies.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Book</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Share Type</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {copies.map((copy) => (
              <TableRow key={copy.id}>
                <TableCell>
                  <div>
                    {copy.edition?.book?.id ? (
                      <button
                        type="button"
                        onClick={() => handleOpenBookDetails(copy)}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {copy.edition.book.title}
                      </button>
                    ) : (
                      <span className="font-medium">Unknown</span>
                    )}
                    {copy.edition?.isbn && (
                      <p className="text-xs text-muted-foreground">
                        ISBN: {copy.edition.isbn}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="capitalize">
                  {copy.edition?.format?.replace("_", " ") ?? "-"}
                </TableCell>
                <TableCell className="capitalize">
                  {copy.condition?.replace("_", " ") ?? "-"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      copy.status === "available" ? "default" : "secondary"
                    }
                  >
                    {statusLabels[copy.status] ?? copy.status}
                  </Badge>
                  {copy.status === "lent" && copy.borrower_user_id && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Borrowed by {memberNameById.get(copy.borrower_user_id) ?? copy.borrower_user_id}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {copy.share_type ? (
                    <Badge variant="outline">
                      {shareTypeLabels[copy.share_type] ?? copy.share_type}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => confirmMutation.mutate(copy.id)}
                      >
                        Confirm Available
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/my-library/${copy.id}/edit`}>
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {copy.status === "available" ? (
                        <>
                          <DropdownMenuItem
                            onClick={() =>
                              statusMutation.mutate({
                                id: copy.id,
                                body: { status: "reserved" },
                              })
                            }
                          >
                            Mark Reserved
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openStatusDialog(copy.id, "lent")}
                          >
                            Mark Lent Out
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openStatusDialog(copy.id, "sold")}
                          >
                            Mark Sold
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openStatusDialog(copy.id, "given_away")}
                          >
                            Mark Given Away
                          </DropdownMenuItem>
                        </>
                      ) : copy.status === "lent" ? (
                        <DropdownMenuItem
                          onClick={() =>
                            statusMutation.mutate({
                              id: copy.id,
                              body: { status: "available" },
                            })
                          }
                        >
                          Mark Returned
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() =>
                            statusMutation.mutate({
                              id: copy.id,
                              body: { status: "available" },
                            })
                          }
                        >
                          Mark Available
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(copy.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed">
          <p className="text-muted-foreground">No copies in your library yet</p>
          <Link href="/my-library/add">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add your first copy
            </Button>
          </Link>
        </div>
      )}

      <BookDetailsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bookId={selectedBook?.id ?? null}
        fallbackTitle={selectedBook?.title}
        fallbackSubtitle={selectedBook?.subtitle}
        preferredImageUrl={selectedBook?.preferredImageUrl}
      />

      <Dialog
        open={!!statusDialog}
        onOpenChange={(open) => {
          if (!open) {
            setStatusDialog(null);
            setCounterpartyUserId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Community Member</DialogTitle>
            <DialogDescription>
              Choose who received this copy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="counterparty">Member</Label>
            <Select value={counterpartyUserId} onValueChange={setCounterpartyUserId}>
              <SelectTrigger id="counterparty">
                <SelectValue placeholder="Select member..." />
              </SelectTrigger>
              <SelectContent>
                {(members ?? [])
                  .filter((member) => member.user_id !== currentUser?.id)
                  .map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    @{member.username}
                    {member.display_name ? ` (${member.display_name})` : ""}
                  </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStatusDialog(null);
                setCounterpartyUserId("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={submitStatusDialog}
              disabled={!counterpartyUserId || statusMutation.isPending}
            >
              {statusMutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
