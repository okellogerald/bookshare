"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
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
  useCreateSubmissionCopyImagePresign,
  useSubmitCopyRequest,
} from "@/shared/queries/submissions";

function parseAuthors(rawValue: string) {
  return Array.from(
    new Set(
      rawValue
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export default function AddCopyPage() {
  const [title, setTitle] = useState("");
  const [authorsInput, setAuthorsInput] = useState("");
  const [isbn, setIsbn] = useState("");
  const [language, setLanguage] = useState("");
  const [bookDescriptionNotes, setBookDescriptionNotes] = useState("");
  const [condition, setCondition] = useState("unspecified");
  const [shareType, setShareType] = useState("unspecified");
  const [notes, setNotes] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const createSubmissionCopyImagePresign = useCreateSubmissionCopyImagePresign();
  const submitCopyRequest = useSubmitCopyRequest();

  function handleImageSelection(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);

    if (list.length + selectedImages.length > 5) {
      setImageError("You can upload up to 5 images.");
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
    setSelectedImages((current) => [...current, ...list].slice(0, 5));
  }

  async function handleSubmit() {
    setFormError(null);
    setSubmitted(false);

    const parsedTitle = title.trim();
    const parsedAuthors = parseAuthors(authorsInput);

    if (!parsedTitle) {
      setFormError("Book title is required.");
      return;
    }

    if (parsedAuthors.length === 0) {
      setFormError("At least one author is required.");
      return;
    }

    try {
      const imageUrls: string[] = [];

      for (const file of selectedImages) {
        const presign = await createSubmissionCopyImagePresign.mutateAsync({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        });

        const uploadResponse = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload one of the copy images.");
        }

        imageUrls.push(presign.publicUrl);
      }

      await submitCopyRequest.mutateAsync({
        title: parsedTitle,
        authors: parsedAuthors,
        isbn: isbn.trim() || undefined,
        language: language.trim() || undefined,
        bookDescriptionNotes: bookDescriptionNotes.trim() || undefined,
        condition: condition === "unspecified" ? undefined : condition,
        shareType: shareType === "unspecified" ? undefined : shareType,
        notes: notes.trim() || undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      });

      setSubmitted(true);
      setTitle("");
      setAuthorsInput("");
      setIsbn("");
      setLanguage("");
      setBookDescriptionNotes("");
      setCondition("unspecified");
      setShareType("unspecified");
      setNotes("");
      setSelectedImages([]);
      setImageError(null);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not submit this copy request."
      );
    }
  }

  const isSubmitting =
    createSubmissionCopyImagePresign.isPending || submitCopyRequest.isPending;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/my-library">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Copy</h1>
          <p className="text-muted-foreground">
            Submit copy details for admin processing.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Book Identifiers</CardTitle>
          <CardDescription>
            Title and author are required. Other identifiers are optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>
              Book Title <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter book title"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Author(s) <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={authorsInput}
              onChange={(event) => setAuthorsInput(event.target.value)}
              placeholder="One per line or comma-separated"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>ISBN</Label>
              <Input
                value={isbn}
                onChange={(event) => setIsbn(event.target.value)}
                placeholder="Optional ISBN"
              />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Input
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                placeholder="e.g. en, sw"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Book Description Notes</Label>
            <Textarea
              value={bookDescriptionNotes}
              onChange={(event) => setBookDescriptionNotes(event.target.value)}
              placeholder="Anything that can help identify the book"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Copy Details</CardTitle>
          <CardDescription>
            Add optional copy details and images.
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
                  <SelectItem value="unspecified">Not specified</SelectItem>
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unspecified">Not specified</SelectItem>
                  <SelectItem value="lend">Lend</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                  <SelectItem value="give_away">Give Away</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Any additional notes about this copy"
              rows={4}
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
            <p className="text-xs text-muted-foreground">
              Up to 5 images, 5MB each (jpg/png/webp).
            </p>
            {!!selectedImages.length && (
              <div className="space-y-1 text-sm text-muted-foreground">
                {selectedImages.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded border px-2 py-1"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      className="text-destructive"
                      onClick={() =>
                        setSelectedImages((current) =>
                          current.filter((_, currentIndex) => currentIndex !== index)
                        )
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

          {submitted && (
            <p className="text-sm text-emerald-700">
              Submission sent. You will receive a confirmation email shortly.
            </p>
          )}
          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex justify-end gap-2">
            <Link href="/my-library">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Copy
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
