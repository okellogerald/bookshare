"use client";

import { useState } from "react";
import { Quote, Pencil, Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import { useCurrentUser } from "@/shared/providers/user-provider";
import {
  useQuotesByBook,
  useCreateQuote,
  useUpdateQuote,
  useDeleteQuote,
} from "@/shared/queries/quotes";

interface BookDetailDialogProps {
  bookId: string;
  editionId?: string;
  bookTitle: string;
  bookSubtitle?: string | null;
  authors: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookDetailDialog({
  bookId,
  editionId,
  bookTitle,
  bookSubtitle,
  authors,
  open,
  onOpenChange,
}: BookDetailDialogProps) {
  const user = useCurrentUser();
  const { data: quotes, isLoading } = useQuotesByBook(open ? bookId : undefined);

  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newChapter, setNewChapter] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editChapter, setEditChapter] = useState("");

  async function handleAdd() {
    if (!newText.trim() || !editionId) return;
    await createQuote.mutateAsync({
      editionId,
      text: newText.trim(),
      chapter: newChapter.trim() || undefined,
    });
    setNewText("");
    setNewChapter("");
    setShowAddForm(false);
  }

  async function handleUpdate() {
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

  async function handleDelete(id: string) {
    await deleteQuote.mutateAsync(id);
  }

  function startEdit(quote: { id: string; text: string; chapter: string | null }) {
    setEditingId(quote.id);
    setEditText(quote.text);
    setEditChapter(quote.chapter ?? "");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{bookTitle}</DialogTitle>
          {bookSubtitle && (
            <DialogDescription>{bookSubtitle}</DialogDescription>
          )}
          {authors && (
            <p className="text-sm text-muted-foreground">by {authors}</p>
          )}
        </DialogHeader>

        <Separator />

        {/* Quotes section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Quote className="h-4 w-4" />
              Quotes
            </h3>
            {user && editionId && !showAddForm && (
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

          {/* Add form */}
          {showAddForm && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="quote-text">Quote</Label>
                <Textarea
                  id="quote-text"
                  placeholder="Enter a memorable quote from this book..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-chapter">Chapter (optional)</Label>
                <Input
                  id="quote-chapter"
                  placeholder="e.g. Chapter 3, Part 1"
                  value={newChapter}
                  onChange={(e) => setNewChapter(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={!newText.trim() || createQuote.isPending}
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
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Quotes list */}
          {isLoading ? (
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
                          onClick={handleUpdate}
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
                      <p className="text-sm italic">
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
                            onClick={() => handleDelete(quote.id)}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
