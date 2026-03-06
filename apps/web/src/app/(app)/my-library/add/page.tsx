"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Loader2, X } from "lucide-react";
import Link from "next/link";
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
import { Badge } from "@/shared/components/ui/badge";
import {
  useAllCategories,
  useEditionByIsbn,
  useCreateCopy,
  useCreateCopyImagePresign,
  useCreateEditionCoverPresign,
  useCreateBook,
  useCreateEdition,
  useCreateAuthor,
  useAttachCopyImages,
  useSearchAuthors,
} from "@/shared/queries/my-library";
import { useBookCategories } from "@/shared/queries/books";

interface SelectedAuthor {
  id?: string;
  name: string;
}

const languageOptions = [
  { value: "en", label: "English (en)" },
  { value: "sw", label: "Swahili (sw)" },
  { value: "fr", label: "French (fr)" },
  { value: "es", label: "Spanish (es)" },
  { value: "de", label: "German (de)" },
  { value: "ar", label: "Arabic (ar)" },
  { value: "other", label: "Other (custom code)" },
];

export default function AddCopyPage() {
  const router = useRouter();

  // ISBN search
  const [isbn, setIsbn] = useState("");
  const [searchIsbn, setSearchIsbn] = useState("");
  const { data: edition, isLoading: isSearching } =
    useEditionByIsbn(searchIsbn);

  // New book fields (when ISBN not found)
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookSubtitle, setNewBookSubtitle] = useState("");
  const [newBookDescription, setNewBookDescription] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // New edition fields
  const [newBookFormat, setNewBookFormat] = useState("paperback");
  const [newBookLanguageMode, setNewBookLanguageMode] = useState("en");
  const [newBookLanguageCustom, setNewBookLanguageCustom] = useState("");
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [newPublisher, setNewPublisher] = useState("");
  const [newPublishedYear, setNewPublishedYear] = useState("");
  const [newPageCount, setNewPageCount] = useState("");
  const [selectedEditionCover, setSelectedEditionCover] = useState<File | null>(null);
  const [editionCoverError, setEditionCoverError] = useState<string | null>(null);

  // Author fields
  const [authorInput, setAuthorInput] = useState("");
  const [selectedAuthors, setSelectedAuthors] = useState<SelectedAuthor[]>([]);
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const { data: authorResults } = useSearchAuthors(authorInput);
  const authorDropdownRef = useRef<HTMLDivElement>(null);
  const { data: allCategories } = useAllCategories();
  const editionBookId = ((edition as any)?.book?.id as string | undefined) ?? "";
  const { data: editionBookWithCategories } = useBookCategories(editionBookId);

  // Copy fields
  const [condition, setCondition] = useState("good");
  const [acquisitionType, setAcquisitionType] = useState("purchased");
  const [shareType, setShareType] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  const createCopy = useCreateCopy();
  const createCopyImagePresign = useCreateCopyImagePresign();
  const createEditionCoverPresign = useCreateEditionCoverPresign();
  const attachCopyImages = useAttachCopyImages();
  const createBook = useCreateBook();
  const createEdition = useCreateEdition();
  const createAuthor = useCreateAuthor();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close author dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        authorDropdownRef.current &&
        !authorDropdownRef.current.contains(e.target as Node)
      ) {
        setShowAuthorDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = () => {
    if (isbn.length >= 10) {
      setSearchIsbn(isbn);
    }
  };

  function selectExistingAuthor(author: { id: string; name: string }) {
    if (!selectedAuthors.some((a) => a.id === author.id)) {
      setSelectedAuthors((prev) => [
        ...prev,
        { id: author.id, name: author.name },
      ]);
    }
    setAuthorInput("");
    setShowAuthorDropdown(false);
  }

  function addNewAuthor() {
    const name = authorInput.trim();
    if (!name) return;
    if (
      !selectedAuthors.some(
        (a) => a.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setSelectedAuthors((prev) => [...prev, { name }]);
    }
    setAuthorInput("");
    setShowAuthorDropdown(false);
  }

  function removeAuthor(index: number) {
    setSelectedAuthors((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleSelectedCategory(categoryId: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }

  function handleImageSelection(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    if (list.length + selectedImages.length > 5) {
      setImageError("You can upload up to 5 images per copy.");
      return;
    }

    for (const file of list) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setImageError("Only jpg, png, and webp images are supported.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setImageError("Each image must be 5MB or less.");
        return;
      }
    }

    setImageError(null);
    setSelectedImages((prev) => [...prev, ...list].slice(0, 5));
  }

  function handleEditionCoverSelection(files: FileList | null) {
    if (!files?.[0]) return;
    const file = files[0];

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setEditionCoverError("Only jpg, png, and webp images are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setEditionCoverError("Edition cover image must be 5MB or less.");
      return;
    }

    setEditionCoverError(null);
    setSelectedEditionCover(file);
  }

  function resolveBookLanguage() {
    if (newBookLanguageMode === "other") {
      const custom = newBookLanguageCustom.trim().toLowerCase();
      if (!custom) return null;
      return custom;
    }
    return newBookLanguageMode;
  }

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let editionId: string;

      if (edition) {
        // Edition found — use its ID
        editionId = edition.id;
      } else {
        // Resolve author IDs — create new ones as needed
        const authorIds: string[] = [];
        for (const author of selectedAuthors) {
          if (author.id) {
            authorIds.push(author.id);
          } else {
            const created = await createAuthor.mutateAsync({
              name: author.name,
            });
            authorIds.push(created.id);
          }
        }

        const resolvedLanguage = resolveBookLanguage();
        if (!resolvedLanguage) {
          setLanguageError("Language code is required when using custom language.");
          return;
        }
        setLanguageError(null);

        // Create book
        if (!newBookTitle.trim()) return;
        const book = await createBook.mutateAsync({
          title: newBookTitle.trim(),
          subtitle: newBookSubtitle.trim() || undefined,
          description: newBookDescription.trim() || undefined,
          language: resolvedLanguage,
          authorIds: authorIds.length > 0 ? authorIds : undefined,
          categoryIds:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        });

        let coverImageUrl: string | undefined;
        if (selectedEditionCover) {
          const coverPresign = await createEditionCoverPresign.mutateAsync({
            fileName: selectedEditionCover.name,
            contentType: selectedEditionCover.type,
            fileSize: selectedEditionCover.size,
          });
          const coverUploadRes = await fetch(coverPresign.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": selectedEditionCover.type },
            body: selectedEditionCover,
          });
          if (!coverUploadRes.ok) {
            throw new Error("Failed to upload edition cover image");
          }
          coverImageUrl = coverPresign.publicUrl;
        }

        // Create edition
        const newEdition = await createEdition.mutateAsync({
          bookId: book.id,
          isbn: searchIsbn || undefined,
          format: newBookFormat,
          publisher: newPublisher.trim() || undefined,
          publishedYear: newPublishedYear
            ? Number(newPublishedYear)
            : undefined,
          pageCount: newPageCount ? Number(newPageCount) : undefined,
          coverImageUrl,
        });
        editionId = newEdition.id;
      }

      const createdCopy = await createCopy.mutateAsync({
        editionId,
        condition,
        acquisitionType,
        shareType: shareType || undefined,
        contactNote: contactNote || undefined,
        location: location || undefined,
        notes: notes || undefined,
      });

      if (selectedImages.length > 0) {
        const uploadedImages: Array<{
          objectKey: string;
          imageUrl: string;
          sortOrder: number;
        }> = [];

        for (let index = 0; index < selectedImages.length; index += 1) {
          const file = selectedImages[index];
          const presign = await createCopyImagePresign.mutateAsync({
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
          });
          const uploadRes = await fetch(presign.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!uploadRes.ok) {
            throw new Error("Failed to upload copy image");
          }
          uploadedImages.push({
            objectKey: presign.objectKey,
            imageUrl: presign.publicUrl,
            sortOrder: index,
          });
        }

        await attachCopyImages.mutateAsync({
          id: createdCopy.id,
          body: { images: uploadedImages },
        });
      }

      router.push("/my-library");
    } catch (error) {
      console.error("Failed to add copy:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const editionFound = searchIsbn.length >= 10 && edition;
  const editionNotFound = searchIsbn.length >= 10 && !isSearching && !edition;
  const showCopyForm =
    editionFound || (editionNotFound && newBookTitle.trim());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/my-library">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Copy</h1>
          <p className="text-muted-foreground">
            Enter an ISBN to find the book or create a new entry
          </p>
        </div>
      </div>

      {/* Step 1: ISBN Search */}
      <Card>
        <CardHeader>
          <CardTitle>Find by ISBN</CardTitle>
          <CardDescription>
            Search for a book edition using its ISBN
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter ISBN (10 or 13 digits)..."
              value={isbn}
              onChange={(e) =>
                setIsbn(e.target.value.replace(/[^0-9X-]/gi, ""))
              }
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              onClick={handleSearch}
              disabled={isbn.length < 10 || isSearching}
              className="gap-2"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          {/* Edition found */}
          {editionFound && (
            <div className="mt-4 rounded-md border bg-muted/50 p-4">
              <p className="font-medium">
                {(edition as any).book?.title ?? "Book found"}
              </p>
              <p className="text-sm text-muted-foreground">
                {edition.format} &middot;{" "}
                {edition.publisher ?? "Unknown publisher"}{" "}
                {edition.published_year
                  ? `(${edition.published_year})`
                  : ""}
              </p>
              {edition.isbn && (
                <p className="text-xs text-muted-foreground">
                  ISBN: {edition.isbn}
                </p>
              )}
              <div className="mt-3 space-y-1">
                <p className="text-xs text-muted-foreground">Categories</p>
                {editionBookWithCategories?.categories?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {editionBookWithCategories.categories.map((category) => (
                      <Badge key={category.id} variant="outline">
                        {category.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No categories assigned.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Edition not found — create new */}
          {editionNotFound && (
            <div className="mt-4 space-y-4 rounded-md border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                No edition found for this ISBN. Create a new book entry:
              </p>

              {/* Book details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>
                    Book Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Enter book title..."
                    value={newBookTitle}
                    onChange={(e) => setNewBookTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Subtitle</Label>
                  <Input
                    placeholder="Enter subtitle (optional)..."
                    value={newBookSubtitle}
                    onChange={(e) => setNewBookSubtitle(e.target.value)}
                  />
                </div>

                {/* Author input with search */}
                <div className="space-y-2" ref={authorDropdownRef}>
                  <Label>Author(s)</Label>
                  {selectedAuthors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAuthors.map((author, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="gap-1 pr-1"
                        >
                          {author.name}
                          {!author.id && (
                            <span className="text-xs text-muted-foreground">
                              (new)
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAuthor(i)}
                            className="ml-0.5 rounded-sm hover:bg-muted"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <Input
                      placeholder="Search or type author name..."
                      value={authorInput}
                      onChange={(e) => {
                        setAuthorInput(e.target.value);
                        setShowAuthorDropdown(true);
                      }}
                      onFocus={() => setShowAuthorDropdown(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addNewAuthor();
                        }
                      }}
                    />
                    {showAuthorDropdown && authorInput.length >= 2 && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                        {authorResults && authorResults.length > 0 && (
                          <div className="max-h-[150px] overflow-y-auto">
                            {authorResults.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => selectExistingAuthor(a)}
                                className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent"
                              >
                                {a.name}
                              </button>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={addNewAuthor}
                          className="flex w-full items-center border-t px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
                        >
                          Add &quot;{authorInput.trim()}&quot; as new author
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Brief description of the book (optional)..."
                    value={newBookDescription}
                    onChange={(e) => setNewBookDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Categories</Label>
                  {!allCategories?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No categories available.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allCategories.map((category) => {
                        const selected = selectedCategoryIds.includes(category.id);
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => toggleSelectedCategory(category.id)}
                          >
                            <Badge variant={selected ? "default" : "outline"}>
                              {category.name}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Edition details */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={newBookLanguageMode}
                    onValueChange={(value) => {
                      setNewBookLanguageMode(value);
                      if (value !== "other") {
                        setLanguageError(null);
                      }
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
                  {newBookLanguageMode === "other" && (
                    <Input
                      placeholder="Enter language code, e.g. it"
                      value={newBookLanguageCustom}
                      onChange={(e) => setNewBookLanguageCustom(e.target.value)}
                    />
                  )}
                  {languageError && (
                    <p className="text-sm text-destructive">{languageError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select
                    value={newBookFormat}
                    onValueChange={setNewBookFormat}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hardcover">Hardcover</SelectItem>
                      <SelectItem value="paperback">Paperback</SelectItem>
                      <SelectItem value="mass_market">
                        Mass Market
                      </SelectItem>
                      <SelectItem value="ebook">eBook</SelectItem>
                      <SelectItem value="audiobook">Audiobook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Publisher</Label>
                  <Input
                    placeholder="e.g. Penguin Books"
                    value={newPublisher}
                    onChange={(e) => setNewPublisher(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Publication Year</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 2023"
                    value={newPublishedYear}
                    onChange={(e) => setNewPublishedYear(e.target.value)}
                    min={1000}
                    max={new Date().getFullYear() + 1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Page Count</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 320"
                    value={newPageCount}
                    onChange={(e) => setNewPageCount(e.target.value)}
                    min={1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Edition Cover</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    handleEditionCoverSelection(event.target.files)
                  }
                />
                {selectedEditionCover && (
                  <div className="flex items-center justify-between rounded border px-2 py-1 text-sm text-muted-foreground">
                    <span className="truncate">{selectedEditionCover.name}</span>
                    <button
                      type="button"
                      className="text-destructive"
                      onClick={() => setSelectedEditionCover(null)}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {editionCoverError && (
                  <p className="text-sm text-destructive">{editionCoverError}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Copy Details */}
      {showCopyForm && (
        <Card>
          <CardHeader>
            <CardTitle>Copy Details</CardTitle>
            <CardDescription>
              Set the condition, sharing preferences, and other details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="like_new">Like New</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Acquisition Type</Label>
                <Select
                  value={acquisitionType}
                  onValueChange={setAcquisitionType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchased">Purchased</SelectItem>
                    <SelectItem value="donated">Donated</SelectItem>
                    <SelectItem value="consigned">Consigned</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Share Type</Label>
                <Select value={shareType} onValueChange={setShareType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lend">Lend</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                    <SelectItem value="give_away">Give Away</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  placeholder="e.g. Downtown, Shelf 3..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contact Note</Label>
              <Input
                placeholder="How can others reach you about this book?"
                value={contactNote}
                onChange={(e) => setContactNote(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional notes about this copy..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Copy Images</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => handleImageSelection(event.target.files)}
              />
              {!!selectedImages.length && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  {selectedImages.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded border px-2 py-1">
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        className="text-destructive"
                        onClick={() =>
                          setSelectedImages((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {imageError && (
                <p className="text-sm text-destructive">{imageError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/my-library">
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Add Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
