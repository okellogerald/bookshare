"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  useConfirmCopy,
  useDeleteCopy,
  useMyCopies,
  useUpdateCopyStatus,
} from "@/shared/queries/my-library";

type LibraryCopyStatus = "available" | "shelved" | "lent" | "gone";
type GoneReason = "sold" | "donated" | "given_away" | "lost";

const statusLabels: Record<LibraryCopyStatus, string> = {
  available: "Available",
  shelved: "Shelved",
  lent: "Lent",
  gone: "Gone",
};

const statusActionLabels: Record<LibraryCopyStatus, string> = {
  available: "Mark Available",
  shelved: "Mark Shelved",
  lent: "Mark Lent",
  gone: "Mark Gone",
};

const shareTypeLabels: Record<string, string> = {
  lend: "Lend",
  sell: "Sell",
  give_away: "Give Away",
};

const goneReasonLabels: Record<GoneReason, string> = {
  sold: "Sold",
  donated: "Donated",
  given_away: "Given Away",
  lost: "Lost",
};

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

const statusOptions: LibraryCopyStatus[] = [
  "available",
  "shelved",
  "lent",
  "gone",
];

function getDefaultGoneReason(
  shareType: string | null | undefined
): GoneReason | "" {
  if (shareType === "sell") return "sold";
  if (shareType === "give_away") return "given_away";
  return "";
}

const pageSize = 24;

export default function MyLibraryPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<{
    id: string;
    focusEditionId?: string | null;
    title?: string;
    subtitle?: string | null;
    preferredImageUrl?: string | null;
  } | null>(null);
  const [selectedBookCopy, setSelectedBookCopy] = useState<
    NonNullable<ReturnType<typeof useMyCopies>["data"]>[number] | null
  >(null);
  const [goneDialogCopy, setGoneDialogCopy] = useState<
    NonNullable<ReturnType<typeof useMyCopies>["data"]>[number] | null
  >(null);
  const [goneReason, setGoneReason] = useState<GoneReason | "">("");
  const [page, setPage] = useState(1);

  const { data: copies, isLoading } = useMyCopies();
  const confirmMutation = useConfirmCopy();
  const statusMutation = useUpdateCopyStatus();
  const deleteMutation = useDeleteCopy();

  const filteredCopies = useMemo(() => {
    const term = search.trim().toLowerCase();
    const allCopies = copies ?? [];
    if (!term) return allCopies;

    return allCopies.filter((copy) => {
      const title = copy.edition?.book?.title ?? "";
      const subtitle = copy.edition?.book?.subtitle ?? "";
      const isbn = copy.edition?.isbn ?? "";
      const publisher = copy.edition?.publisher ?? "";
      const notes = copy.notes ?? "";
      const haystack = `${title} ${subtitle} ${isbn} ${publisher} ${notes}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [copies, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCopies.length / pageSize));
  const pagedCopies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCopies.slice(start, start + pageSize);
  }, [filteredCopies, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function handleOpenBookDetails(copy: NonNullable<typeof copies>[number]) {
    const book = copy.edition?.book;
    if (!book?.id) return;
    setSelectedBookCopy(copy);
    setSelectedBook({
      id: book.id,
      focusEditionId: copy.edition?.id ?? null,
      title: book.title,
      subtitle: book.subtitle,
      preferredImageUrl: copy.edition?.cover_image_url ?? null,
    });
    setDialogOpen(true);
  }

  function handleStatusChange(
    copy: NonNullable<typeof copies>[number],
    status: LibraryCopyStatus
  ) {
    if (status === "gone") {
      setGoneDialogCopy(copy);
      setGoneReason(getDefaultGoneReason(copy.share_type));
      return;
    }

    statusMutation.mutate({
      id: copy.id,
      body: { status },
    });
  }

  function handleConfirmGone() {
    if (!goneDialogCopy || !goneReason) return;

    statusMutation.mutate(
      {
        id: goneDialogCopy.id,
        body: {
          status: "gone",
          goneReason,
        },
      },
      {
        onSuccess: () => {
          setGoneDialogCopy(null);
          setGoneReason("");
        },
      }
    );
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

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by title, subtitle, ISBN, publisher, or notes..."
        className="max-w-xl"
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : copies && copies.length > 0 ? (
        <>
          {filteredCopies.length > 0 ? (
            <>
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
                  {pagedCopies.map((copy) => (
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
                        {copy.edition?.format
                          ? (formatLabels[copy.edition.format] ?? copy.edition.format)
                          : "-"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {copy.condition?.replace("_", " ") ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={copy.status === "available" ? "default" : "secondary"}
                        >
                          {statusLabels[copy.status as LibraryCopyStatus] ?? copy.status}
                        </Badge>
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
                              Confirm Listing
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/my-library/${copy.id}/edit`}>
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {statusOptions
                              .filter((status) => status !== copy.status)
                              .map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={() => handleStatusChange(copy, status)}
                                >
                                  {statusActionLabels[status]}
                                </DropdownMenuItem>
                              ))}
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
              <PaginationControls
                page={page}
                pageSize={pageSize}
                totalItems={filteredCopies.length}
                onPageChange={setPage}
              />
            </>
          ) : (
            <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground">No copies match your search.</p>
            </div>
          )}
        </>
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
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedBookCopy(null);
          }
        }}
        bookId={selectedBook?.id ?? null}
        focusEditionId={selectedBook?.focusEditionId ?? null}
        hideEditionList
        fallbackTitle={selectedBook?.title}
        fallbackSubtitle={selectedBook?.subtitle}
        preferredImageUrl={selectedBook?.preferredImageUrl}
      >
        {selectedBookCopy && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Your Copy
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">
                {selectedBookCopy.edition?.format
                  ? (formatLabels[selectedBookCopy.edition.format] ??
                    selectedBookCopy.edition.format)
                  : "Unknown format"}
              </Badge>
              {selectedBookCopy.edition?.isbn && (
                <Badge variant="outline">ISBN: {selectedBookCopy.edition.isbn}</Badge>
              )}
              <Badge
                variant={
                  selectedBookCopy.status === "available" ? "default" : "secondary"
                }
              >
                {statusLabels[selectedBookCopy.status as LibraryCopyStatus] ??
                  selectedBookCopy.status}
              </Badge>
              {selectedBookCopy.share_type && (
                <Badge variant="outline">
                  {shareTypeLabels[selectedBookCopy.share_type] ??
                    selectedBookCopy.share_type}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Condition:{" "}
              {selectedBookCopy.condition
                ? selectedBookCopy.condition.replace("_", " ")
                : "Unknown"}
            </p>
            {selectedBookCopy.edition?.publisher && (
              <p className="text-sm text-muted-foreground">
                Publisher: {selectedBookCopy.edition.publisher}
                {selectedBookCopy.edition.published_year
                  ? ` • ${selectedBookCopy.edition.published_year}`
                  : ""}
                {selectedBookCopy.edition.page_count
                  ? ` • ${selectedBookCopy.edition.page_count} pages`
                  : ""}
              </p>
            )}
            {selectedBookCopy.notes && (
              <p className="text-sm">
                <span className="font-medium">Notes:</span> {selectedBookCopy.notes}
              </p>
            )}
          </div>
        )}
      </BookDetailsDialog>

      <Dialog
        open={!!goneDialogCopy}
        onOpenChange={(open) => {
          if (statusMutation.isPending) return;
          if (!open) {
            setGoneDialogCopy(null);
            setGoneReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Copy Gone</DialogTitle>
            <DialogDescription>
              Choose why this copy is no longer in your library. This reason
              becomes the timeline event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Gone Reason</Label>
            <Select
              value={goneReason}
              onValueChange={(value) => setGoneReason(value as GoneReason)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(goneReasonLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {goneDialogCopy?.edition?.book?.title && (
              <p className="text-xs text-muted-foreground">
                Copy: {goneDialogCopy.edition.book.title}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setGoneDialogCopy(null);
                setGoneReason("");
              }}
              disabled={statusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmGone}
              disabled={!goneReason || statusMutation.isPending}
            >
              Save Reason
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
