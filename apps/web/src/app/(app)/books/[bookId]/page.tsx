"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Quote,
  Pencil,
  Trash2,
  Plus,
  Users,
  Loader2,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useBookDetail, useEditionsByBook, useListingsByBook } from "@/shared/queries/books";
import {
  useQuotesByBook,
  useCreateQuote,
  useUpdateQuote,
  useDeleteQuote,
} from "@/shared/queries/quotes";
import { useCurrentUser } from "@/shared/providers/user-provider";

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
  const user = useCurrentUser();

  const { data: book, isLoading: bookLoading } = useBookDetail(bookId);
  const { data: editions } = useEditionsByBook(bookId);
  const { data: quotes, isLoading: quotesLoading } = useQuotesByBook(bookId);
  const { data: listings } = useListingsByBook(bookId);

  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();

  // Quote add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newChapter, setNewChapter] = useState("");
  const [selectedEditionId, setSelectedEditionId] = useState("");

  // Quote edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editChapter, setEditChapter] = useState("");

  // Auto-select edition if only one
  const resolvedEditionId =
    selectedEditionId || (editions?.length === 1 ? editions[0].id : "");

  async function handleAddQuote() {
    if (!newText.trim() || !resolvedEditionId) return;
    await createQuote.mutateAsync({
      editionId: resolvedEditionId,
      text: newText.trim(),
      chapter: newChapter.trim() || undefined,
    });
    setNewText("");
    setNewChapter("");
    setSelectedEditionId("");
    setShowAddForm(false);
  }

  async function handleUpdateQuote() {
    if (!editingId || !editText.trim()) return;
    await updateQuote.mutateAsync({
      id: editingId,
      body: {
        text: editText.trim(),
        chapter: editChapter.trim() || undefined,
      },
    });
    setEditingId(null);
  }

  async function handleDeleteQuote(id: string) {
    await deleteQuote.mutateAsync(id);
  }

  function startEdit(quote: {
    id: string;
    text: string;
    chapter: string | null;
  }) {
    setEditingId(quote.id);
    setEditText(quote.text);
    setEditChapter(quote.chapter ?? "");
  }

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

  const authors = book.authors?.map((a) => a.name).join(", ") ?? "";

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link href="/browse">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Browse
        </Button>
      </Link>

      {/* Header */}
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
      </div>

      {/* Description */}
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

      {/* Editions */}
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

      {/* Quotes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Quote className="h-4 w-4" />
              Quotes
              {quotes && quotes.length > 0 && (
                <span className="text-muted-foreground">
                  ({quotes.length})
                </span>
              )}
            </CardTitle>
            {user && editions && editions.length > 0 && !showAddForm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Quote
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add quote form */}
          {showAddForm && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label>Quote</Label>
                <Textarea
                  placeholder="Enter a memorable quote from this book..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Chapter (optional)</Label>
                <Input
                  placeholder="e.g. Chapter 3, Part 1"
                  value={newChapter}
                  onChange={(e) => setNewChapter(e.target.value)}
                />
              </div>
              {editions && editions.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Edition</Label>
                  <Select
                    value={selectedEditionId}
                    onValueChange={setSelectedEditionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select edition..." />
                    </SelectTrigger>
                    <SelectContent>
                      {editions.map((ed) => (
                        <SelectItem key={ed.id} value={ed.id}>
                          {formatLabels[ed.format] ?? ed.format}
                          {ed.isbn ? ` (${ed.isbn})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddQuote}
                  disabled={
                    !newText.trim() ||
                    !resolvedEditionId ||
                    createQuote.isPending
                  }
                >
                  {createQuote.isPending ? "Adding..." : "Add"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewText("");
                    setNewChapter("");
                    setSelectedEditionId("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Quotes list */}
          {quotesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : quotes && quotes.length > 0 ? (
            <div className="space-y-3">
              {quotes.map((quote) => (
                <div key={quote.id} className="rounded-lg border p-3">
                  {editingId === quote.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                      />
                      <Input
                        placeholder="Chapter (optional)"
                        value={editChapter}
                        onChange={(e) => setEditChapter(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleUpdateQuote}
                          disabled={
                            !editText.trim() || updateQuote.isPending
                          }
                        >
                          {updateQuote.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm italic leading-relaxed">
                        &ldquo;{quote.text}&rdquo;
                      </p>
                      {quote.chapter && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {quote.chapter}
                        </p>
                      )}
                      {user && user.id === quote.added_by && (
                        <div className="mt-2 flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => startEdit(quote)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteQuote(quote.id)}
                            disabled={deleteQuote.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No quotes yet. Be the first to add one!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Available Copies */}
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
                    {listing.contact_note && (
                      <p className="text-sm">{listing.contact_note}</p>
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
