"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
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
import {
  useEditionByIsbn,
  useCreateCopy,
  useCreateBook,
  useCreateEdition,
} from "@/shared/queries/my-library";

export default function AddCopyPage() {
  const router = useRouter();

  // ISBN search
  const [isbn, setIsbn] = useState("");
  const [searchIsbn, setSearchIsbn] = useState("");
  const { data: edition, isLoading: isSearching } = useEditionByIsbn(searchIsbn);

  // New book fields (when ISBN not found)
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookFormat, setNewBookFormat] = useState("paperback");

  // Copy fields
  const [condition, setCondition] = useState("good");
  const [acquisitionType, setAcquisitionType] = useState("purchased");
  const [shareType, setShareType] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const createCopy = useCreateCopy();
  const createBook = useCreateBook();
  const createEdition = useCreateEdition();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = () => {
    if (isbn.length >= 10) {
      setSearchIsbn(isbn);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let editionId: string;

      if (edition) {
        // Edition found — use its ID
        editionId = edition.id;
      } else {
        // Create book + edition
        if (!newBookTitle.trim()) return;
        const book = await createBook.mutateAsync({
          title: newBookTitle.trim(),
        });
        const newEdition = await createEdition.mutateAsync({
          bookId: book.id,
          isbn: searchIsbn || undefined,
          format: newBookFormat,
        });
        editionId = newEdition.id;
      }

      await createCopy.mutateAsync({
        editionId,
        condition,
        acquisitionType,
        shareType: shareType || undefined,
        contactNote: contactNote || undefined,
        location: location || undefined,
        notes: notes || undefined,
      });

      router.push("/my-library");
    } catch (error) {
      console.error("Failed to add copy:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const editionFound = searchIsbn.length >= 10 && edition;
  const editionNotFound = searchIsbn.length >= 10 && !isSearching && !edition;
  const showCopyForm = editionFound || (editionNotFound && newBookTitle.trim());

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
              onChange={(e) => setIsbn(e.target.value.replace(/[^0-9X-]/gi, ""))}
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
                {edition.format} &middot; {edition.publisher ?? "Unknown publisher"}{" "}
                {edition.published_year ? `(${edition.published_year})` : ""}
              </p>
              {edition.isbn && (
                <p className="text-xs text-muted-foreground">
                  ISBN: {edition.isbn}
                </p>
              )}
            </div>
          )}

          {/* Edition not found — create new */}
          {editionNotFound && (
            <div className="mt-4 space-y-4 rounded-md border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                No edition found for this ISBN. Create a new book entry:
              </p>
              <div className="space-y-2">
                <Label>Book Title</Label>
                <Input
                  placeholder="Enter book title..."
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={newBookFormat} onValueChange={setNewBookFormat}>
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
                <Select value={acquisitionType} onValueChange={setAcquisitionType}>
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

            <div className="flex justify-end gap-2">
              <Link href="/my-library">
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
