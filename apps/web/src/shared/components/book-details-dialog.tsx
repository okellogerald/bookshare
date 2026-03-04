"use client";

import type { ReactNode } from "react";
import { Badge } from "@/shared/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Separator } from "@/shared/components/ui/separator";
import { useBookDetail, useEditionsByBook } from "@/shared/queries/books";

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
  ebook: "eBook",
  audiobook: "Audiobook",
};

interface BookDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string | null;
  fallbackTitle?: string;
  fallbackSubtitle?: string | null;
  children?: ReactNode;
  footer?: ReactNode;
}

export function BookDetailsDialog({
  open,
  onOpenChange,
  bookId,
  fallbackTitle,
  fallbackSubtitle,
  children,
  footer,
}: BookDetailsDialogProps) {
  const queryBookId = bookId ?? "";
  const { data: book, isLoading: bookLoading } = useBookDetail(queryBookId);
  const { data: editions, isLoading: editionsLoading } = useEditionsByBook(queryBookId);

  const title = book?.title ?? fallbackTitle ?? "Book details";
  const subtitle = book?.subtitle ?? fallbackSubtitle;
  const authors = book?.authors?.map((author) => author.name).join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        {!bookId ? (
          <p className="text-sm text-muted-foreground">
            Select a book to view details.
          </p>
        ) : bookLoading ? (
          <div className="space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        ) : !book ? (
          <p className="text-sm text-muted-foreground">
            Could not load book details.
          </p>
        ) : (
          <div className="space-y-4">
            {authors && <p className="text-sm text-muted-foreground">By {authors}</p>}

            {book.language && (
              <Badge variant="outline">{book.language.toUpperCase()}</Badge>
            )}

            {book.description ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {book.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No description provided.
              </p>
            )}

            {children}

            <Separator />

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Editions</h3>
              {editionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="h-14 animate-pulse rounded border bg-muted" />
                  ))}
                </div>
              ) : editions && editions.length > 0 ? (
                <div className="space-y-2">
                  {editions.map((edition) => (
                    <div key={edition.id} className="space-y-1 rounded border p-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary">
                          {formatLabels[edition.format] ?? edition.format}
                        </Badge>
                        {edition.isbn && (
                          <Badge variant="outline">ISBN: {edition.isbn}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {edition.publisher ?? "Unknown publisher"}
                        {edition.published_year ? ` • ${edition.published_year}` : ""}
                        {edition.page_count ? ` • ${edition.page_count} pages` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No edition information available.
                </p>
              )}
            </div>
          </div>
        )}

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
