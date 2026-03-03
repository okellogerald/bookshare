"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useEditionByIsbn, useCreateWant } from "@/shared/queries/my-wants";

export default function AddWantPage() {
  const router = useRouter();
  const [isbn, setIsbn] = useState("");
  const [notes, setNotes] = useState("");

  const { data: edition, isLoading: searchingEdition } =
    useEditionByIsbn(isbn);
  const createWant = useCreateWant();

  // The edition query returns PgEdition with embedded book
  const book = edition ? (edition as any).book : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!book?.id) return;

    createWant.mutate(
      { bookId: book.id, notes: notes || undefined },
      { onSuccess: () => router.push("/my-wants") }
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add a Want</h1>
        <p className="text-muted-foreground">
          Search by ISBN to find the book you&apos;re looking for
        </p>
      </div>

      {/* Step 1: ISBN search */}
      <div className="space-y-2">
        <Label htmlFor="isbn">ISBN</Label>
        <Input
          id="isbn"
          placeholder="Enter ISBN (10 or 13 digits)"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value.trim())}
        />
        {searchingEdition && (
          <p className="text-sm text-muted-foreground">Searching...</p>
        )}
      </div>

      {/* Step 2: Show book if found */}
      {edition && book && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{book.title}</CardTitle>
            {book.subtitle && (
              <CardDescription>{book.subtitle}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>ISBN: {edition.isbn}</p>
            {edition.publisher && <p>Publisher: {edition.publisher}</p>}
            {edition.published_year && <p>Year: {edition.published_year}</p>}
          </CardContent>
        </Card>
      )}

      {isbn.length >= 10 && !searchingEdition && !edition && (
        <p className="text-sm text-muted-foreground">
          No book found for this ISBN. The book must exist in the catalog before
          you can post a want for it.
        </p>
      )}

      {/* Step 3: Notes + submit */}
      {book && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g. Looking for any edition in good condition, preferably hardcover"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={createWant.isPending}>
              {createWant.isPending ? "Posting..." : "Post Want"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/my-wants")}
            >
              Cancel
            </Button>
          </div>

          {createWant.isError && (
            <p className="text-sm text-destructive">
              {createWant.error.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
