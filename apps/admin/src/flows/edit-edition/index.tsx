"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import {
  useAdminUpdateEdition,
  useEditionCoverPresign,
  uploadToPresignedUrl,
  type CatalogEditionRecord,
} from "@/domain/catalog/queries";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function EditEditionFlow({
  edition,
  onClose,
}: {
  edition: CatalogEditionRecord;
  onClose: () => void;
}) {
  const [isbn, setIsbn] = useState(edition.isbn ?? "");
  const [format, setFormat] = useState(edition.format ?? "paperback");
  const [publisher, setPublisher] = useState(edition.publisher ?? "");
  const [year, setYear] = useState(edition.published_year?.toString() ?? "");
  const [pageCount, setPageCount] = useState(edition.page_count?.toString() ?? "");
  const [description, setDescription] = useState(edition.description ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useAdminUpdateEdition();
  const presignMutation = useEditionCoverPresign();
  const isSaving = updateMutation.isPending || presignMutation.isPending;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be under 5 MB.");
      return;
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError(null);
  }

  function clearCoverFile() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    setError(null);

    let coverImageUrl: string | undefined;

    if (coverFile) {
      const trimmedIsbn = isbn.trim();
      if (!trimmedIsbn) {
        setError("ISBN is required to upload a cover image.");
        return;
      }
      try {
        const presign = await presignMutation.mutateAsync({
          isbn: trimmedIsbn,
          fileName: coverFile.name,
          contentType: coverFile.type,
          fileSize: coverFile.size,
        });
        await uploadToPresignedUrl(presign.uploadUrl, coverFile);
        coverImageUrl = presign.publicUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cover upload failed.");
        return;
      }
    }

    try {
      await updateMutation.mutateAsync({
        id: edition.id,
        isbn: isbn.trim() || undefined,
        format: format || undefined,
        publisher: publisher.trim() || undefined,
        publishedYear: year ? Number(year) : undefined,
        pageCount: pageCount ? Number(pageCount) : undefined,
        description: description.trim() || undefined,
        ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  const displayedCover = coverPreview ?? edition.cover_image_url;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>ISBN</Label>
          <Input
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            placeholder="e.g. 9780140186399"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Format</Label>
          <Select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="paperback">Paperback</option>
            <option value="hardcover">Hardcover</option>
            <option value="mass_market">Mass Market</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Publisher</Label>
          <Input value={publisher} onChange={(e) => setPublisher(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Input value={year} onChange={(e) => setYear(e.target.value)} type="number" />
        </div>
        <div className="space-y-1.5">
          <Label>Page count</Label>
          <Input value={pageCount} onChange={(e) => setPageCount(e.target.value)} type="number" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
      </div>

      {/* Cover image */}
      <div className="space-y-3 rounded-lg border border-border/70 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Cover image</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stored as <code className="rounded bg-muted px-1 py-0.5 text-[11px]">edition-covers/&#123;isbn&#125;.&#123;ext&#125;</code> — uploading with the same ISBN replaces the existing file.
          </p>
        </div>

        <div className="flex items-start gap-4">
          {displayedCover && (
            <div className="relative shrink-0">
              <img
                src={displayedCover}
                alt=""
                className="h-24 w-16 rounded object-cover shadow-sm ring-1 ring-border/50"
              />
              {coverFile && (
                <button
                  type="button"
                  onClick={clearCoverFile}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-background shadow ring-1 ring-border"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {coverFile
                ? "Change image"
                : displayedCover
                  ? "Replace cover"
                  : "Upload cover"}
            </Button>
            {coverFile ? (
              <p className="text-xs text-muted-foreground">{coverFile.name}</p>
            ) : !displayedCover ? (
              <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP · max 5 MB</p>
            ) : null}
            {coverFile && !isbn.trim() && (
              <p className="text-xs text-amber-600">
                An ISBN is required to upload a cover.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2 border-t border-border/70 pt-4">
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
