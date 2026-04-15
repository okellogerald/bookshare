"use client";

import { type FormEvent, useRef, useState } from "react";
import { BookUp, ImagePlus, Loader2, X } from "lucide-react";
import {
  useCreateBook,
  useCreateEdition,
  useEditionCoverPresign,
  uploadToPresignedUrl,
  type AuthorRecord,
  type CreateBookInput,
  type CreateEditionInput,
} from "@/shared/queries/catalog";
import { AuthorPicker } from "./author-picker";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

interface NewBookFormProps {
  onClose: () => void;
  onCreated: () => void;
  surface?: "card" | "plain";
}

export function NewBookForm({
  onClose,
  onCreated,
  surface = "card",
}: NewBookFormProps) {
  // Book fields
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [authors, setAuthors] = useState<AuthorRecord[]>([]);

  // Edition fields
  const [isbn, setIsbn] = useState("");
  const [format, setFormat] = useState<CreateEditionInput["format"]>("paperback");
  const [publisher, setPublisher] = useState("");
  const [publishedYear, setPublishedYear] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [description, setDescription] = useState("");

  // Cover image
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);

  const createBook = useCreateBook();
  const createEdition = useCreateEdition();
  const editionCoverPresign = useEditionCoverPresign();

  const isSaving =
    createBook.isPending ||
    createEdition.isPending ||
    editionCoverPresign.isPending;

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError("Cover image must be 5 MB or less.");
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError(null);
  }

  function clearCover() {
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedIsbn = isbn.trim();

    if (authors.length === 0) {
      setError("At least one author is required.");
      return;
    }

    if (coverFile && !trimmedIsbn) {
      setError("ISBN is required when uploading a cover image.");
      return;
    }

    const bookInput: CreateBookInput = {
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      language: language.trim() || "en",
      authorIds: authors.map((a) => a.id),
    };

    try {
      // 1. Create the book
      const book = await createBook.mutateAsync(bookInput);

      // 2. Upload cover image if provided
      let coverImageUrl: string | undefined;

      if (coverFile && trimmedIsbn) {
        const presign = await editionCoverPresign.mutateAsync({
          isbn: trimmedIsbn,
          fileName: coverFile.name,
          contentType: coverFile.type,
          fileSize: coverFile.size,
        });

        await uploadToPresignedUrl(presign.uploadUrl, coverFile);
        coverImageUrl = presign.publicUrl;
      }

      // 3. Create the edition
      const editionInput: CreateEditionInput = {
        bookId: book.id,
        format,
        isbn: trimmedIsbn || undefined,
        publisher: publisher.trim() || undefined,
        publishedYear: publishedYear ? Number(publishedYear) : undefined,
        pageCount: pageCount ? Number(pageCount) : undefined,
        description: description.trim() || undefined,
        coverImageUrl,
      };

      await createEdition.mutateAsync(editionInput);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save edition.");
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-8">
          {/* ── Book details ── */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Title
            </legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nb-title">Title *</Label>
                <Input
                  id="nb-title"
                  required
                  maxLength={500}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Things Fall Apart"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nb-subtitle">Subtitle</Label>
                <Input
                  id="nb-subtitle"
                  maxLength={1000}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Optional subtitle"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nb-language">Language</Label>
                <Input
                  id="nb-language"
                  maxLength={10}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="en"
                />
              </div>

              <div className="sm:col-span-2">
                <AuthorPicker selected={authors} onChange={setAuthors} />
              </div>
            </div>
          </fieldset>

          {/* ── Edition details ── */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Edition
            </legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nb-isbn">ISBN</Label>
                <Input
                  id="nb-isbn"
                  maxLength={20}
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="978-0-14-018639-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nb-format">Format *</Label>
                <Select
                  id="nb-format"
                  required
                  value={format}
                  onChange={(e) => setFormat(e.target.value as CreateEditionInput["format"])}
                >
                  <option value="paperback">Paperback</option>
                  <option value="hardcover">Hardcover</option>
                  <option value="mass_market">Mass Market</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nb-publisher">Publisher</Label>
                <Input
                  id="nb-publisher"
                  maxLength={500}
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder="e.g. Penguin Books"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nb-year">Published year</Label>
                <Input
                  id="nb-year"
                  type="number"
                  min={1000}
                  max={2100}
                  value={publishedYear}
                  onChange={(e) => setPublishedYear(e.target.value)}
                  placeholder="1958"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nb-pages">Page count</Label>
                <Input
                  id="nb-pages"
                  type="number"
                  min={1}
                  value={pageCount}
                  onChange={(e) => setPageCount(e.target.value)}
                  placeholder="209"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nb-cover">Cover image</Label>
                <div className="flex items-start gap-4">
                  {coverPreview ? (
                    <div className="relative shrink-0">
                      <img
                        src={coverPreview}
                        alt="Cover preview"
                        className="h-28 w-20 rounded-lg border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearCover}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}
                  <div className="flex-1 space-y-1">
                    <input
                      ref={fileInputRef}
                      id="nb-cover"
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES}
                      onChange={handleCoverChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="h-4 w-4" />
                      {coverFile ? "Change image" : "Choose image"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, or WebP. Max 5 MB. Requires ISBN.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nb-description">Description</Label>
                <Textarea
                  id="nb-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of this edition"
                  rows={3}
                />
              </div>
            </div>
          </fieldset>

          {error && (
            <p className="text-sm text-red-700">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !title.trim() || authors.length === 0}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save edition"
              )}
            </Button>
          </div>
        </form>
  );

  if (surface === "plain") {
    return form;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <BookUp className="h-5 w-5" />
            Add new edition
          </CardTitle>
          <CardDescription>
            Add an edition here. If the title does not exist yet, enter its details below and
            the flow will create it first.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent>{form}</CardContent>
    </Card>
  );
}
