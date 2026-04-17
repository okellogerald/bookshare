"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Loader2, Users } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  useBookCategories,
  useBookDetail,
  useEditionsByBook,
  useListingsByBook,
} from "@/domains/books/queries";

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

const shareTypeLabels: Record<string, string> = {
  lend: "Lend",
  sell: "Sell",
  give_away: "Give Away",
};

const conditionLabels: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

function getMemberName(firstName: string | null, lastName: string | null) {
  const fullName = [firstName, lastName]
    .filter((value): value is string => !!value && value.trim().length > 0)
    .join(" ")
    .trim();
  return fullName || "Community member";
}

export default function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>();

  const { data: book, isLoading: bookLoading } = useBookDetail(bookId);
  const { data: bookWithCategories } = useBookCategories(bookId);
  const { data: editions } = useEditionsByBook(bookId);
  const { data: listings } = useListingsByBook(bookId);
  const editionCount = editions?.length ?? 0;
  const editionDescription =
    editions?.find((edition) => edition.description)?.description ?? null;
  const visibleCategoryBadges = useMemo(() => {
    const categories = bookWithCategories?.categories ?? [];
    if (categories.length === 0) return [];

    const seenLabels = new Set<string>();
    return categories
      .map((category) => ({
        ...category,
        displayName: category.name,
      }))
      .filter((category) => {
        const key = category.displayName.toLowerCase();
        if (seenLabels.has(key)) return false;
        seenLabels.add(key);
        return true;
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [bookWithCategories?.categories]);

  if (bookLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="space-y-4">
        <Link href="/browse">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Browse
          </Button>
        </Link>
        <p className="text-muted-foreground">Book not found.</p>
      </div>
    );
  }

  const authors = book.authors?.map((author) => author.name).join(", ") ?? "";

  return (
    <div className="space-y-6">
      <Link href="/browse">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Browse
        </Button>
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{book.title}</h1>
        {book.subtitle && (
          <p className="text-xl text-muted-foreground">{book.subtitle}</p>
        )}
        {authors && (
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <Users className="h-4 w-4" />
            {authors}
          </p>
        )}
        {book.language && book.language !== "en" && (
          <Badge variant="outline">{book.language.toUpperCase()}</Badge>
        )}
        {editionCount > 1 && (
          <Badge variant="outline">{editionCount} editions</Badge>
        )}
        {visibleCategoryBadges.length ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleCategoryBadges.map((category) => (
              <Badge key={category.thema_code} variant="secondary">
                {category.displayName}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {editionDescription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              About This Book
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {editionDescription}
            </p>
          </CardContent>
        </Card>
      )}

      {listings && listings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Available Copies ({listings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {editionCount > 1 && (
                <p className="text-sm text-muted-foreground">
                  These copies are currently available across {editionCount} editions.
                </p>
              )}
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5">
                      {listing.share_type && (
                        <Badge variant="default">
                          {shareTypeLabels[listing.share_type] ??
                            listing.share_type}
                        </Badge>
                      )}
                      <Badge variant="secondary">
                        {conditionLabels[listing.condition] ??
                          listing.condition}
                      </Badge>
                      <Badge variant="outline">
                        {formatLabels[listing.format] ?? listing.format}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Listed by{" "}
                      {getMemberName(
                        listing.owner_first_name,
                        listing.owner_last_name
                      )}
                    </p>
                    {listing.contact_note && (
                      <p className="text-xs text-muted-foreground">
                        Contact note: {listing.contact_note}
                      </p>
                    )}
                    {listing.status === "lent" && (
                      <p className="text-xs text-muted-foreground">
                        {listing.borrower_first_name || listing.borrower_last_name
                          ? `Borrowed by ${getMemberName(
                              listing.borrower_first_name,
                              listing.borrower_last_name
                            )} from ${getMemberName(
                              listing.owner_first_name,
                              listing.owner_last_name
                            )}`
                          : "Borrowed off-platform"}
                      </p>
                    )}
                  </div>
                  {listing.isbn && (
                    <p className="text-xs text-muted-foreground">
                      ISBN: {listing.isbn}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
