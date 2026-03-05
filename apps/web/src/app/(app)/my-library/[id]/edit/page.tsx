"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
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
import {
  useUpdateCopy,
  useAttachCopyImages,
  useUpdateBook,
  useUpdateEdition,
  useBookWithAuthors,
  useCreateCopyImagePresign,
  useDeleteCopyImage,
  useSearchAuthors,
  useCreateAuthor,
} from "@/shared/queries/my-library";
import type { PgCopyDetail } from "@/shared/api";

async function fetchCopy(id: string): Promise<PgCopyDetail> {
  const params = new URLSearchParams();
  params.set("id", `eq.${id}`);
  params.set("select", "*,edition:editions(*,book:books(*)),images:copy_images(*)");

  const response = await fetch(`/api/postgrest/copies?${params}`);
  if (!response.ok) throw new Error("Failed to fetch copy");
  const json = await response.json();
  if (!json.data?.[0]) throw new Error("Copy not found");
  return json.data[0];
}

interface SelectedAuthor {
  id?: string;
  name: string;
}

export default function EditCopyPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const { data: copy, isLoading } = useQuery({
    queryKey: ["copy", id],
    queryFn: () => fetchCopy(id),
  });

  const bookId = copy?.edition?.book?.id;
  const editionId = copy?.edition?.id;

  const { data: bookWithAuthors } = useBookWithAuthors(bookId);

  // Book fields
  const [bookTitle, setBookTitle] = useState("");
  const [bookSubtitle, setBookSubtitle] = useState("");
  const [bookDescription, setBookDescription] = useState("");

  // Edition fields
  const [format, setFormat] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedYear, setPublishedYear] = useState("");
  const [pageCount, setPageCount] = useState("");

  // Author fields
  const [authorInput, setAuthorInput] = useState("");
  const [selectedAuthors, setSelectedAuthors] = useState<SelectedAuthor[]>([]);
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const { data: authorResults } = useSearchAuthors(authorInput);
  const authorDropdownRef = useRef<HTMLDivElement>(null);

  // Copy fields
  const [condition, setCondition] = useState("");
  const [shareType, setShareType] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  const updateCopy = useUpdateCopy();
  const attachCopyImages = useAttachCopyImages();
  const createCopyImagePresign = useCreateCopyImagePresign();
  const deleteCopyImage = useDeleteCopyImage();
  const updateBook = useUpdateBook();
  const updateEdition = useUpdateEdition();
  const createAuthor = useCreateAuthor();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate copy fields
  useEffect(() => {
    if (copy) {
      setCondition(copy.condition ?? "good");
      setShareType(copy.share_type ?? "");
      setContactNote(copy.contact_note ?? "");
      setLocation(copy.location ?? "");
      setNotes(copy.notes ?? "");

      // Edition fields
      setFormat(copy.edition?.format ?? "");
      setPublisher(copy.edition?.publisher ?? "");
      setPublishedYear(
        copy.edition?.published_year
          ? String(copy.edition.published_year)
          : ""
      );
      setPageCount(
        copy.edition?.page_count ? String(copy.edition.page_count) : ""
      );

      // Book fields
      setBookTitle(copy.edition?.book?.title ?? "");
      setBookSubtitle(copy.edition?.book?.subtitle ?? "");
      setBookDescription(copy.edition?.book?.description ?? "");
    }
  }, [copy]);

  // Populate authors when bookWithAuthors loads
  useEffect(() => {
    if (bookWithAuthors?.authors) {
      setSelectedAuthors(
        bookWithAuthors.authors.map((a) => ({ id: a.id, name: a.name }))
      );
    }
  }, [bookWithAuthors]);

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

  function selectExistingAuthor(author: { id: string; name: string }) {
    if (!selectedAuthors.some((a) => a.id === author.id)) {
      setSelectedAuthors((prev) => [...prev, { id: author.id, name: author.name }]);
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

  function handleImageSelection(files: FileList | null) {
    if (!files) return;
    const existingCount = copy?.images?.length ?? 0;
    const list = Array.from(files);
    if (existingCount + selectedImages.length + list.length > 5) {
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

  const handleSubmit = async () => {
    if (!bookId || !editionId) return;
    setIsSubmitting(true);
    try {
      // Resolve author IDs
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

      // Update book
      await updateBook.mutateAsync({
        id: bookId,
        body: {
          title: bookTitle.trim() || undefined,
          subtitle: bookSubtitle.trim() || undefined,
          description: bookDescription.trim() || undefined,
          authorIds,
        },
      });

      // Update edition
      await updateEdition.mutateAsync({
        id: editionId,
        body: {
          format: format || undefined,
          publisher: publisher.trim() || undefined,
          publishedYear: publishedYear ? Number(publishedYear) : undefined,
          pageCount: pageCount ? Number(pageCount) : undefined,
        },
      });

      // Update copy
      await updateCopy.mutateAsync({
        id,
        body: {
          condition: condition || undefined,
          shareType: shareType || undefined,
          contactNote: contactNote || undefined,
          location: location || undefined,
          notes: notes || undefined,
        },
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
            sortOrder: (copy?.images?.length ?? 0) + index,
          });
        }

        await attachCopyImages.mutateAsync({
          id,
          body: { images: uploadedImages },
        });
      }

      router.push("/my-library");
    } catch (error) {
      console.error("Failed to update:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/my-library">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Copy</h1>
          <p className="text-muted-foreground">
            {copy?.edition?.book?.title ?? "Loading..."}
            {copy?.edition?.isbn ? ` (ISBN: ${copy.edition.isbn})` : ""}
          </p>
        </div>
      </div>

      {/* Book & Edition Details */}
      <Card>
        <CardHeader>
          <CardTitle>Book &amp; Edition Details</CardTitle>
          <CardDescription>
            Update the book information and edition details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Book fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Book Title</Label>
              <Input
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input
                placeholder="Enter subtitle (optional)..."
                value={bookSubtitle}
                onChange={(e) => setBookSubtitle(e.target.value)}
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
                value={bookDescription}
                onChange={(e) => setBookDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Edition fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hardcover">Hardcover</SelectItem>
                  <SelectItem value="paperback">Paperback</SelectItem>
                  <SelectItem value="mass_market">Mass Market</SelectItem>
                  <SelectItem value="ebook">eBook</SelectItem>
                  <SelectItem value="audiobook">Audiobook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Publisher</Label>
              <Input
                placeholder="e.g. Penguin Books"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Publication Year</Label>
              <Input
                type="number"
                placeholder="e.g. 2023"
                value={publishedYear}
                onChange={(e) => setPublishedYear(e.target.value)}
                min={1000}
                max={new Date().getFullYear() + 1}
              />
            </div>

            <div className="space-y-2">
              <Label>Page Count</Label>
              <Input
                type="number"
                placeholder="e.g. 320"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
                min={1}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Copy Details */}
      <Card>
        <CardHeader>
          <CardTitle>Copy Details</CardTitle>
          <CardDescription>
            Update condition, sharing preferences, and other details
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
            <Label>Existing Images</Label>
            {!copy?.images?.length ? (
              <p className="text-sm text-muted-foreground">No images uploaded.</p>
            ) : (
              <div className="space-y-2">
                {copy.images.map((image) => (
                  <div key={image.id} className="flex items-center gap-3 rounded border p-2">
                    <img
                      src={image.image_url}
                      alt="Copy"
                      className="h-16 w-16 rounded object-cover"
                    />
                    <div className="flex-1">
                      <p className="truncate text-sm">{image.image_url}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deleteCopyImage.mutate({ id, imageId: image.id })}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Add Images</Label>
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
            {imageError && <p className="text-sm text-destructive">{imageError}</p>}
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
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
