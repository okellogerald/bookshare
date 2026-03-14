"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import { CopyStatusTransitionFields } from "@/shared/components/copy-status-transition-fields";
import { LibraryCopyDialog } from "@/shared/components/library-copy-dialog";
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
import {
  buildStatusTransitionBody,
  createStatusTransitionFormState,
  getApiErrorMessage,
  getStatusTransitionValidationMessage,
  type LibraryCopyStatus,
  type StatusTransitionFormState,
  shareTypeLabels,
  statusActionLabels,
  statusLabels,
} from "@/shared/lib/copy-status";

type LibrarySortOption =
  | "added_desc"
  | "added_asc"
  | "title_asc"
  | "title_desc"
  | "confirmed_desc";

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

const conditionLabels: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

const statusOptions: LibraryCopyStatus[] = [
  "available",
  "shelved",
  "lent",
  "gone",
];

function humanizeToken(value: string) {
  return value.replace(/_/g, " ");
}

function getCopyTitle(
  copy: NonNullable<ReturnType<typeof useMyCopies>["data"]>[number]
) {
  return copy.edition?.book?.title ?? "";
}

const pageSize = 24;

export default function MyLibraryPage() {
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [shareTypeFilter, setShareTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState<LibrarySortOption>("added_desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBookCopy, setSelectedBookCopy] = useState<
    NonNullable<ReturnType<typeof useMyCopies>["data"]>[number] | null
  >(null);
  const [statusDialogCopy, setStatusDialogCopy] = useState<
    NonNullable<ReturnType<typeof useMyCopies>["data"]>[number] | null
  >(null);
  const [statusDialogForm, setStatusDialogForm] =
    useState<StatusTransitionFormState>(() =>
      createStatusTransitionFormState("available", null)
    );
  const [statusDialogError, setStatusDialogError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: copies, isLoading } = useMyCopies();
  const confirmMutation = useConfirmCopy();
  const statusMutation = useUpdateCopyStatus();
  const deleteMutation = useDeleteCopy();

  const filteredCopies = useMemo(() => {
    const term = search.trim().toLowerCase();
    const allCopies = copies ?? [];
    return allCopies.filter((copy) => {
      if (conditionFilter && copy.condition !== conditionFilter) return false;
      if (formatFilter && copy.edition?.format !== formatFilter) return false;
      if (statusFilter && copy.status !== statusFilter) return false;
      if (shareTypeFilter && copy.share_type !== shareTypeFilter) return false;
      if (!term) return true;

      const title = copy.edition?.book?.title ?? "";
      const subtitle = copy.edition?.book?.subtitle ?? "";
      const isbn = copy.edition?.isbn ?? "";
      const publisher = copy.edition?.publisher ?? "";
      const notes = copy.notes ?? "";
      const haystack = `${title} ${subtitle} ${isbn} ${publisher} ${notes}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [conditionFilter, copies, formatFilter, search, shareTypeFilter, statusFilter]);

  const sortedCopies = useMemo(() => {
    const items = [...filteredCopies];
    items.sort((left, right) => {
      switch (sortBy) {
        case "added_asc":
          return left.created_at.localeCompare(right.created_at);
        case "title_asc":
          return (
            getCopyTitle(left).localeCompare(getCopyTitle(right), undefined, {
              sensitivity: "base",
            }) || right.created_at.localeCompare(left.created_at)
          );
        case "title_desc":
          return (
            getCopyTitle(right).localeCompare(getCopyTitle(left), undefined, {
              sensitivity: "base",
            }) || right.created_at.localeCompare(left.created_at)
          );
        case "confirmed_desc":
          return (right.last_confirmed_at ?? right.created_at).localeCompare(
            left.last_confirmed_at ?? left.created_at
          );
        case "added_desc":
        default:
          return right.created_at.localeCompare(left.created_at);
      }
    });
    return items;
  }, [filteredCopies, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedCopies.length / pageSize));
  const pagedCopies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedCopies.slice(start, start + pageSize);
  }, [page, sortedCopies]);

  useEffect(() => {
    setPage(1);
  }, [conditionFilter, formatFilter, search, shareTypeFilter, sortBy, statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function handleOpenBookDetails(copy: NonNullable<typeof copies>[number]) {
    setSelectedBookCopy(copy);
    setDialogOpen(true);
  }

  function handleStatusChange(
    copy: NonNullable<typeof copies>[number],
    status: LibraryCopyStatus
  ) {
    setStatusDialogCopy(copy);
    setStatusDialogForm(createStatusTransitionFormState(status, copy.share_type));
    setStatusDialogError(null);
  }

  function closeStatusDialog() {
    setStatusDialogCopy(null);
    setStatusDialogForm(createStatusTransitionFormState("available", null));
    setStatusDialogError(null);
  }

  async function handleConfirmStatusChange() {
    if (!statusDialogCopy) return;

    const validationMessage =
      getStatusTransitionValidationMessage(statusDialogForm);
    if (validationMessage) {
      setStatusDialogError(validationMessage);
      return;
    }

    setStatusDialogError(null);

    try {
      await statusMutation.mutateAsync({
        id: statusDialogCopy.id,
        body: buildStatusTransitionBody(statusDialogForm),
      });
      closeStatusDialog();
    } catch (error) {
      setStatusDialogError(
        getApiErrorMessage(error, "Failed to update the copy status.")
      );
    }
  }

  const statusValidationMessage = statusDialogCopy
    ? getStatusTransitionValidationMessage(statusDialogForm)
    : null;
  const displayedStatusMessage = statusDialogError ?? statusValidationMessage;
  const hasStatusError = !!statusDialogError;

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

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title, subtitle, ISBN, publisher, or notes..."
          className="min-w-[240px] flex-1"
        />
        <Select
          value={conditionFilter || "all"}
          onValueChange={(value) =>
            setConditionFilter(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All conditions</SelectItem>
            {Object.entries(conditionLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={formatFilter || "all"}
          onValueChange={(value) => setFormatFilter(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All formats</SelectItem>
            {Object.entries(formatLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter || "all"}
          onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={shareTypeFilter || "all"}
          onValueChange={(value) =>
            setShareTypeFilter(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Share type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(shareTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          onValueChange={(value) => setSortBy(value as LibrarySortOption)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="added_desc">Newest added</SelectItem>
            <SelectItem value="added_asc">Oldest added</SelectItem>
            <SelectItem value="title_asc">Title A-Z</SelectItem>
            <SelectItem value="title_desc">Title Z-A</SelectItem>
            <SelectItem value="confirmed_desc">Recently confirmed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : copies && copies.length > 0 ? (
        <>
          {sortedCopies.length > 0 ? (
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
                        {copy.condition
                          ? (conditionLabels[copy.condition] ??
                            humanizeToken(copy.condition))
                          : "-"}
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
                totalItems={sortedCopies.length}
                onPageChange={setPage}
              />
            </>
          ) : (
            <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground">
                No copies match your current filters.
              </p>
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

      <LibraryCopyDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedBookCopy(null);
          }
        }}
        copy={selectedBookCopy}
      />

      <Dialog
        open={!!statusDialogCopy}
        onOpenChange={(open) => {
          if (statusMutation.isPending) return;
          if (!open) {
            closeStatusDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusDialogForm.targetStatus
                ? statusActionLabels[statusDialogForm.targetStatus]
                : "Update Status"}
            </DialogTitle>
            <DialogDescription>
              Record who has the copy or why the status changed. These details
              are saved to the book timeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {statusDialogCopy?.edition?.book?.title ? (
              <p className="text-xs text-muted-foreground">
                Copy: {statusDialogCopy.edition.book.title}
              </p>
            ) : null}

            <CopyStatusTransitionFields
              bookId={statusDialogCopy?.edition?.book?.id ?? null}
              values={statusDialogForm}
              onChange={(patch) => {
                setStatusDialogError(null);
                setStatusDialogForm((current) => ({
                  ...current,
                  ...patch,
                }));
              }}
              enabled={!!statusDialogCopy}
            />

            {displayedStatusMessage ? (
              <p
                className={`text-sm ${
                  hasStatusError ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {displayedStatusMessage}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeStatusDialog}
              disabled={statusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmStatusChange}
              disabled={!!statusValidationMessage || statusMutation.isPending}
            >
              Save Status Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
