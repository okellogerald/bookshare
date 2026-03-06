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
import { useBookCategories, useBookDetail, useEditionsByBook } from "@/shared/queries/books";

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
  preferredImageUrl?: string | null;
  children?: ReactNode;
  footer?: ReactNode;
}

export function BookDetailsDialog({
  open,
  onOpenChange,
  bookId,
  fallbackTitle,
  fallbackSubtitle,
  preferredImageUrl,
  children,
  footer,
}: BookDetailsDialogProps) {
  const queryBookId = bookId ?? "";
  const { data: book, isLoading: bookLoading } = useBookDetail(queryBookId);
  const { data: bookWithCategories } = useBookCategories(queryBookId);
  const { data: editions, isLoading: editionsLoading } = useEditionsByBook(queryBookId);

  const title = book?.title ?? fallbackTitle ?? "Book details";
  const subtitle = book?.subtitle ?? fallbackSubtitle;
  const authors = book?.authors?.map((author) => author.name).join(", ");
  const fallbackCoverImage =
    editions?.find((edition) => edition.cover_image_url)?.cover_image_url ?? null;
  const heroImageUrl = preferredImageUrl ?? fallbackCoverImage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {heroImageUrl ? (
          <div className="mx-auto w-full max-w-[320px]">
            <div className="aspect-[2/3] overflow-hidden rounded-md border bg-muted/30 p-3 shadow-sm">
              <img
                src={heroImageUrl}
                alt={title}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[320px]">
            <div className="flex aspect-[2/3] items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
              No cover image available
            </div>
          </div>
        )}
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
            {bookWithCategories?.categories?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {bookWithCategories.categories.map((category) => (
                  <Badge key={category.id} variant="secondary">
                    {category.name}
                  </Badge>
                ))}
              </div>
            ) : null}

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
