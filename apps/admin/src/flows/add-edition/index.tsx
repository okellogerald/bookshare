"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { FlowStepper } from "@/shared/components/flow-stepper";
import {
  type AuthorRecord,
  type CreateBookInput,
  type CreateEditionInput,
  useCatalogBookSearch,
  useCreateBook,
  useCreateEdition,
  useEditionCoverPresign,
  uploadToPresignedUrl,
} from "@/domain/catalog/queries";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import type { PgBookWithAuthorsView } from "@/shared/api";
import { AuthorPicker } from "./author-picker";
import { FlowSummaryRow } from "@/shared/components/flow-summary-row";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type AddEditionStep = 1 | 2 | 3 | 4;
type TitleSource = "existing" | "new";

const stepItems: Array<{ step: AddEditionStep; label: string }> = [
  { step: 1, label: "Title" },
  { step: 2, label: "Authors" },
  { step: 3, label: "Edition" },
  { step: 4, label: "Confirm" },
];

function formatAuthors(authors: Array<{ id: string; name: string }>) {
  return authors.length > 0 ? authors.map((author) => author.name).join(", ") : "No authors";
}

export function AddEditionFlow({ onClose }: { onClose: () => void }) {
  const [activeStep, setActiveStep] = useState<AddEditionStep>(1);
  const [titleSource, setTitleSource] = useState<TitleSource>("existing");
  const [titleSearch, setTitleSearch] = useState("");
  const deferredTitleSearch = useDeferredValue(titleSearch);
  const searchQuery = useCatalogBookSearch(deferredTitleSearch);
  const [selectedBook, setSelectedBook] = useState<PgBookWithAuthorsView | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [authors, setAuthors] = useState<AuthorRecord[]>([]);
  const [isbn, setIsbn] = useState("");
  const [format, setFormat] = useState<CreateEditionInput["format"]>("paperback");
  const [publisher, setPublisher] = useState("");
  const [publishedYear, setPublishedYear] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createBook = useCreateBook();
  const createEdition = useCreateEdition();
  const editionCoverPresign = useEditionCoverPresign();

  const isSaving =
    createBook.isPending || createEdition.isPending || editionCoverPresign.isPending;
  const existingResults = searchQuery.data ?? [];
  const usingExistingTitle = titleSource === "existing";
  const currentTitle = usingExistingTitle ? selectedBook?.title ?? "" : title.trim();
  const currentSubtitle = usingExistingTitle ? selectedBook?.subtitle ?? "" : subtitle.trim();
  const currentLanguage = usingExistingTitle ? selectedBook?.language ?? "" : language.trim();
  const currentAuthors = usingExistingTitle
    ? selectedBook?.authors ?? []
    : authors.map((author) => ({ id: author.id, name: author.name }));

  const canContinueTitleStep =
    titleSource === "existing" ? !!selectedBook : title.trim().length > 0;
  const canContinueAuthorStep =
    titleSource === "existing" ? !!selectedBook : authors.length > 0;
  const canContinueEditionStep = format.length > 0;

  const canOpenStep = (step: AddEditionStep) => {
    if (step === 1) return true;
    if (step === 2) return canContinueTitleStep;
    if (step === 3) return canContinueAuthorStep;
    return canContinueEditionStep && canContinueAuthorStep && canContinueTitleStep;
  };

  useEffect(() => {
    return () => {
      if (coverPreview) {
        URL.revokeObjectURL(coverPreview);
      }
    };
  }, [coverPreview]);

  const summaryItems = useMemo(
    () => [
      {
        label: "Title",
        value: (
          <>
            <p className="font-medium">{currentTitle || "—"}</p>
            {currentSubtitle ? (
              <p className="mt-1 text-muted-foreground">{currentSubtitle}</p>
            ) : null}
          </>
        ),
      },
      {
        label: "Language",
        value: currentLanguage || "—",
      },
      {
        label: "Authors",
        value: formatAuthors(currentAuthors),
      },
      {
        label: "Format",
        value: format.replace(/_/g, " "),
      },
      {
        label: "ISBN",
        value: isbn.trim() || "—",
      },
      {
        label: "Publisher",
        value: publisher.trim() || "—",
      },
      {
        label: "Published Year",
        value: publishedYear || "—",
      },
      {
        label: "Page Count",
        value: pageCount || "—",
      },
      {
        label: "Description",
        value: description.trim() || "—",
      },
    ],
    [
      currentAuthors,
      currentLanguage,
      currentSubtitle,
      currentTitle,
      description,
      format,
      isbn,
      pageCount,
      publishedYear,
      publisher,
    ]
  );

  function handleCoverChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError("Cover image must be 5 MB or less.");
      return;
    }

    if (coverPreview) {
      URL.revokeObjectURL(coverPreview);
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

  async function handleSubmit() {
    setError(null);

    if (!canContinueAuthorStep) {
      setError("At least one author is required before the edition can be saved.");
      return;
    }

    const trimmedIsbn = isbn.trim();
    if (coverFile && !trimmedIsbn) {
      setError("ISBN is required when uploading a cover image.");
      return;
    }

    try {
      let bookId = selectedBook?.id;

      if (!usingExistingTitle) {
        const bookInput: CreateBookInput = {
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          language: language.trim() || "en",
          authorIds: authors.map((author) => author.id),
        };
        const book = await createBook.mutateAsync(bookInput);
        bookId = book.id;
      }

      if (!bookId) {
        throw new Error("A valid book selection is required.");
      }

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

      await createEdition.mutateAsync({
        bookId,
        format,
        isbn: trimmedIsbn || undefined,
        publisher: publisher.trim() || undefined,
        publishedYear: publishedYear ? Number(publishedYear) : undefined,
        pageCount: pageCount ? Number(pageCount) : undefined,
        description: description.trim() || undefined,
        coverImageUrl,
      });

      onClose();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Failed to save edition."
      );
    }
  }

  return (
    <div className="space-y-6">
      <FlowStepper
        items={stepItems.map((item) => ({
          step: item.step,
          label: item.label,
          current: activeStep === item.step,
          complete: activeStep > item.step,
          disabled: !canOpenStep(item.step),
          onSelect: canOpenStep(item.step) ? () => setActiveStep(item.step) : undefined,
        }))}
      />

      {activeStep === 1 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Choose the title source</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Search the current catalog first. If the title does not exist yet, switch to a new title draft.
            </p>
          </div>

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-muted-foreground">Title source</legend>
            <div className="space-y-4">
              <label className="flex items-start gap-3">
                <input
                  type="radio"
                  name="title-source"
                  checked={titleSource === "existing"}
                  onChange={() => setTitleSource("existing")}
                  className="mt-1 h-4 w-4 border-border text-primary focus:ring-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Use an existing title</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Reuse a title that is already in the catalog, then add the new edition to it.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3">
                <input
                  type="radio"
                  name="title-source"
                  checked={titleSource === "new"}
                  onChange={() => {
                    setTitleSource("new");
                    setSelectedBook(null);
                  }}
                  className="mt-1 h-4 w-4 border-border text-primary focus:ring-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Create a new title</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Start a brand-new title record with subtitle and language before adding the edition.
                  </p>
                </div>
              </label>
            </div>
          </fieldset>

          {titleSource === "existing" ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={titleSearch}
                  onChange={(event) => setTitleSearch(event.target.value)}
                  placeholder="Search existing titles"
                  className="pl-11"
                />
              </div>

              {deferredTitleSearch.trim().length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  Type at least two characters to search existing titles.
                </p>
              ) : searchQuery.isError ? (
                <p className="text-sm text-red-700">
                  {searchQuery.error instanceof Error
                    ? searchQuery.error.message
                    : "Title search failed."}
                </p>
              ) : searchQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Searching titles...</p>
              ) : existingResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No matching titles found. Switch to “Create a new title” to continue.
                </p>
              ) : (
                <div className="divide-y rounded-2xl border border-border/75">
                  {existingResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => setSelectedBook(result)}
                      className={`w-full px-4 py-4 text-left transition hover:bg-muted/25 ${
                        selectedBook?.id === result.id ? "bg-primary/[0.07] ring-1 ring-inset ring-primary/20" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{result.title}</p>
                          {result.subtitle ? (
                            <p className="mt-1 text-sm text-muted-foreground">{result.subtitle}</p>
                          ) : null}
                          <p className="mt-2 text-sm text-muted-foreground">
                            {formatAuthors(result.authors)}
                          </p>
                        </div>
                        <Badge variant="secondary">{result.language}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edition-title">Title *</Label>
                <Input
                  id="edition-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Things Fall Apart"
                  maxLength={500}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edition-subtitle">Subtitle</Label>
                <Input
                  id="edition-subtitle"
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                  placeholder="Optional subtitle"
                  maxLength={1000}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edition-language">Language</Label>
                <Input
                  id="edition-language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  placeholder="en"
                  maxLength={10}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end border-t pt-5">
            <Button
              type="button"
              onClick={() => setActiveStep(2)}
              disabled={!canContinueTitleStep}
              className="rounded-full px-5"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {activeStep === 2 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Add authors</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose the authors attached to this title before the edition is created.
            </p>
          </div>

          {titleSource === "existing" && selectedBook ? (
            <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
              <div>
                <p className="font-medium text-foreground">{selectedBook.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Existing title selected. The current title authors will be reused for this edition.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedBook.authors.map((author) => (
                  <Badge
                    key={author.id}
                    variant="secondary"
                    className="border border-border/75 bg-background px-3 py-1 text-foreground"
                  >
                    {author.name}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <AuthorPicker selected={authors} onChange={setAuthors} />
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveStep(1)}
              className="rounded-full px-5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              onClick={() => setActiveStep(3)}
              disabled={!canContinueAuthorStep}
              className="rounded-full px-5"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {activeStep === 3 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Add edition details</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Complete the edition-specific fields, then continue to the final confirmation.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edition-isbn">ISBN</Label>
              <Input
                id="edition-isbn"
                value={isbn}
                onChange={(event) => setIsbn(event.target.value)}
                placeholder="978-0-14-018639-9"
                maxLength={20}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edition-format">Format *</Label>
              <Select
                id="edition-format"
                value={format}
                onChange={(event) => setFormat(event.target.value as CreateEditionInput["format"])}
              >
                <option value="paperback">Paperback</option>
                <option value="hardcover">Hardcover</option>
                <option value="mass_market">Mass Market</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edition-publisher">Publisher</Label>
              <Input
                id="edition-publisher"
                value={publisher}
                onChange={(event) => setPublisher(event.target.value)}
                placeholder="e.g. Penguin Books"
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edition-year">Published year</Label>
              <Input
                id="edition-year"
                type="number"
                min={1000}
                max={2100}
                value={publishedYear}
                onChange={(event) => setPublishedYear(event.target.value)}
                placeholder="1958"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edition-pages">Page count</Label>
              <Input
                id="edition-pages"
                type="number"
                min={1}
                value={pageCount}
                onChange={(event) => setPageCount(event.target.value)}
                placeholder="209"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edition-cover">Cover image</Label>
              <div className="flex items-start gap-4 rounded-2xl border border-border/75 bg-background px-4 py-4">
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

                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    id="edition-cover"
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
                    JPG, PNG, or WebP. Max 5 MB. ISBN is required if a cover image is uploaded.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edition-description">Description</Label>
              <Textarea
                id="edition-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A brief description of this edition"
                rows={4}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveStep(2)}
              className="rounded-full px-5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              onClick={() => setActiveStep(4)}
              disabled={!canContinueEditionStep}
              className="rounded-full px-5"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {activeStep === 4 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Confirm addition</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Review the title and edition details before the record is saved.
            </p>
          </div>

          <div className="rounded-2xl border border-border/75 bg-card px-5 py-1">
            {summaryItems.map((item) => (
              <FlowSummaryRow key={item.label} label={item.label} value={item.value} />
            ))}
          </div>

          {coverPreview ? (
            <div className="flex items-center gap-4 rounded-2xl border border-border/75 bg-background px-4 py-4">
              <img
                src={coverPreview}
                alt="Cover preview"
                className="h-28 w-20 rounded-lg border border-border object-cover"
              />
              <div>
                <p className="text-sm font-medium text-foreground">Cover preview ready</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The selected image will be uploaded after you confirm the addition.
                </p>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveStep(3)}
              className="rounded-full px-5"
              disabled={isSaving}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm addition
                </>
              )}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
