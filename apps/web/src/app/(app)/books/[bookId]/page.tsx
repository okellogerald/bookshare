"use client";

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
} from "@/shared/queries/books";

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
  ebook: "eBook",
  audiobook: "Audiobook",
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

export default function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>();

  const { data: book, isLoading: bookLoading } = useBookDetail(bookId);
  const { data: bookWithCategories } = useBookCategories(bookId);
  const { data: editions } = useEditionsByBook(bookId);
  const { data: listings } = useListingsByBook(bookId);

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
        {bookWithCategories?.categories?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {bookWithCategories.categories.map((category) => (
              <Badge key={category.id} variant="secondary">
                {category.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {book.description && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              About This Book
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {book.description}
            </p>
          </CardContent>
        </Card>
      )}

      {editions && editions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Editions ({editions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {editions.map((edition) => (
                <div
                  key={edition.id}
                  className="flex flex-wrap items-start gap-x-6 gap-y-1 rounded-lg border p-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">
                        {formatLabels[edition.format] ?? edition.format}
                      </Badge>
                      {edition.isbn && (
                        <span className="text-xs text-muted-foreground">
                          ISBN: {edition.isbn}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                      {edition.publisher && <span>{edition.publisher}</span>}
                      {edition.published_year && (
                        <span>{edition.published_year}</span>
                      )}
                      {edition.page_count && (
                        <span>{edition.page_count} pages</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    {listing.primary_image_url && (
                      <img
                        src={listing.primary_image_url}
                        alt={listing.book_title}
                        className="mb-2 h-24 w-20 rounded object-cover"
                      />
                    )}
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
                      Listed by @{listing.owner_username ?? "member"}
                      {listing.owner_display_name
                        ? ` • ${listing.owner_display_name}`
                        : ""}
                    </p>
                    {listing.status === "lent" && (
                      <p className="text-xs text-muted-foreground">
                        Borrowed by @{listing.borrower_username ?? "member"} from @
                        {listing.owner_username ?? "member"}
                      </p>
                    )}
                    {listing.location && (
                      <p className="text-xs text-muted-foreground">
                        Location: {listing.location}
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
