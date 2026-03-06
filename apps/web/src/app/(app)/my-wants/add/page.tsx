"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useEditionByIsbn, useCreateWant } from "@/shared/queries/my-wants";
import {
  useCreateBook,
  useCreateEdition,
  useCreateEditionCoverPresign,
  useMyActiveOwnedBookIds,
} from "@/shared/queries/my-library";

const languageOptions = [
  { value: "en", label: "English (en)" },
  { value: "sw", label: "Swahili (sw)" },
  { value: "fr", label: "French (fr)" },
  { value: "es", label: "Spanish (es)" },
  { value: "de", label: "German (de)" },
  { value: "ar", label: "Arabic (ar)" },
  { value: "other", label: "Other (custom code)" },
];

const formatOptions = [
  { value: "hardcover", label: "Hardcover" },
  { value: "paperback", label: "Paperback" },
  { value: "mass_market", label: "Mass Market" },
  { value: "ebook", label: "eBook" },
  { value: "audiobook", label: "Audiobook" },
];

export default function AddWantPage() {
  const router = useRouter();
  const [isbn, setIsbn] = useState("");
  const [notes, setNotes] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualSubtitle, setManualSubtitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [languageMode, setLanguageMode] = useState("en");
  const [languageCustom, setLanguageCustom] = useState("");
  const [manualFormat, setManualFormat] = useState("paperback");
  const [selectedCover, setSelectedCover] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);

  const { data: edition, isLoading: searchingEdition } =
    useEditionByIsbn(isbn);
  const { data: myActiveOwnedBookIds, isLoading: activeOwnedBooksLoading } =
    useMyActiveOwnedBookIds();
  const createWant = useCreateWant();
  const createBook = useCreateBook();
  const createEdition = useCreateEdition();
  const createEditionCoverPresign = useCreateEditionCoverPresign();

  // The edition query returns PgEdition with embedded book
  const book = edition ? (edition as any).book : null;
  const alreadyInMyLibrary = !!book?.id && (myActiveOwnedBookIds ?? []).includes(book.id);
  const noEditionFound = isbn.length >= 10 && !searchingEdition && !edition;
  const showManualForm = noEditionFound;

  useEffect(() => {
    if (edition) {
      setManualError(null);
    }
  }, [edition]);

  function resolveLanguage() {
    if (languageMode === "other") {
      const custom = languageCustom.trim().toLowerCase();
      if (!custom) return null;
      return custom;
    }
    return languageMode;
  }

  function handleCoverSelection(files: FileList | null) {
    if (!files?.[0]) {
      setSelectedCover(null);
      setCoverError(null);
      return;
    }
    const file = files[0];

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setSelectedCover(null);
      setCoverError("Only jpg, png, and webp images are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSelectedCover(null);
      setCoverError("Cover image must be 5MB or less.");
      return;
    }

    setCoverError(null);
    setSelectedCover(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setManualError(null);

    try {
      let targetBookId: string | null = null;

      if (book?.id) {
        if (alreadyInMyLibrary) return;
        targetBookId = book.id;
      } else {
        const title = manualTitle.trim();
        if (!title) {
          setManualError("Book title is required when adding manually.");
          return;
        }

        const language = resolveLanguage();
        if (!language) {
          setManualError("Language code is required when using custom language.");
          return;
        }

        const createdBook = await createBook.mutateAsync({
          title,
          subtitle: manualSubtitle.trim() || undefined,
          description: manualDescription.trim() || undefined,
          language,
        });

        if (selectedCover) {
          const presign = await createEditionCoverPresign.mutateAsync({
            fileName: selectedCover.name,
            contentType: selectedCover.type,
            fileSize: selectedCover.size,
          });
          const uploadResponse = await fetch(presign.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": selectedCover.type },
            body: selectedCover,
          });
          if (!uploadResponse.ok) {
            throw new Error("Failed to upload cover image.");
          }

          await createEdition.mutateAsync({
            bookId: createdBook.id,
            isbn: isbn.trim() || undefined,
            format: manualFormat,
            coverImageUrl: presign.publicUrl,
          });
        }

        targetBookId = createdBook.id;
      }

      if (!targetBookId) return;

      await createWant.mutateAsync({
        bookId: targetBookId,
        notes: notes || undefined,
      });
      router.push("/my-wants");
    } catch (error) {
      if (error instanceof Error) {
        setManualError(error.message);
      } else {
        setManualError("Could not post want.");
      }
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add a Want</h1>
        <p className="text-muted-foreground">
          Search by ISBN, or add book details manually if it is not yet in the catalog.
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

      {noEditionFound && (
        <p className="text-sm text-muted-foreground">
          No book found for this ISBN. Add it manually below to post your want.
        </p>
      )}

      {showManualForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Book Details</CardTitle>
            <CardDescription>
              Create a minimal catalog book so you can post your want.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-title">
                Book Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="manual-title"
                placeholder="Enter book title..."
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-subtitle">Subtitle</Label>
              <Input
                id="manual-subtitle"
                placeholder="Enter subtitle (optional)..."
                value={manualSubtitle}
                onChange={(event) => setManualSubtitle(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-description">Description</Label>
              <Textarea
                id="manual-description"
                placeholder="Optional description..."
                value={manualDescription}
                onChange={(event) => setManualDescription(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={languageMode}
                onValueChange={(value) => {
                  setLanguageMode(value);
                  if (value !== "other") setManualError(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {languageMode === "other" && (
                <Input
                  placeholder="Enter language code, e.g. it"
                  value={languageCustom}
                  onChange={(event) => setLanguageCustom(event.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Format (for cover image edition)</Label>
              <Select value={manualFormat} onValueChange={setManualFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cover Image (optional)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => handleCoverSelection(event.target.files)}
              />
              {selectedCover && (
                <div className="flex items-center justify-between rounded border px-2 py-1 text-sm text-muted-foreground">
                  <span className="truncate">{selectedCover.name}</span>
                  <button
                    type="button"
                    className="text-destructive"
                    onClick={() => {
                      setSelectedCover(null);
                      setCoverError(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
              {coverError && (
                <p className="text-sm text-destructive">{coverError}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Notes + submit */}
      {(book || showManualForm) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {book && alreadyInMyLibrary && (
            <p className="text-sm text-muted-foreground">
              This book is already in your active library, so it cannot be added to wants.
            </p>
          )}
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
            <Button
              type="submit"
              disabled={
                createWant.isPending ||
                createBook.isPending ||
                createEdition.isPending ||
                createEditionCoverPresign.isPending ||
                activeOwnedBooksLoading ||
                (!!book && alreadyInMyLibrary) ||
                (!book && !showManualForm)
              }
            >
              {createWant.isPending ||
              createBook.isPending ||
              createEdition.isPending ||
              createEditionCoverPresign.isPending
                ? "Posting..."
                : "Post Want"}
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
          {createBook.isError && (
            <p className="text-sm text-destructive">
              {createBook.error instanceof Error
                ? createBook.error.message
                : "Failed to create book entry."}
            </p>
          )}
          {createEdition.isError && (
            <p className="text-sm text-destructive">
              {createEdition.error instanceof Error
                ? createEdition.error.message
                : "Failed to create edition."}
            </p>
          )}
          {createEditionCoverPresign.isError && (
            <p className="text-sm text-destructive">
              {createEditionCoverPresign.error instanceof Error
                ? createEditionCoverPresign.error.message
                : "Failed to prepare cover image upload."}
            </p>
          )}
          {manualError && (
            <p className="text-sm text-destructive">{manualError}</p>
          )}
        </form>
      )}
    </div>
  );
}
