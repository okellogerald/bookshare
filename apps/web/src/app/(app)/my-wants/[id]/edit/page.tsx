"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, X } from "lucide-react";
import type { PgWantWithBook } from "@/shared/api";
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
  useAllCategories,
  useBookWithAuthors,
  useCreateAuthor,
  useSearchAuthors,
  useUpdateBook,
} from "@/shared/queries/my-library";
import { useBookCategories } from "@/shared/queries/books";

async function fetchWant(id: string): Promise<PgWantWithBook> {
  const params = new URLSearchParams();
  params.set("id", `eq.${id}`);
  params.set("select", "*,book:books(*)");

  const response = await fetch(`/api/postgrest/wants?${params}`);
  if (!response.ok) throw new Error("Failed to fetch want");
  const json = await response.json();
  if (!json.data?.[0]) throw new Error("Want not found");
  return json.data[0] as PgWantWithBook;
}

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

export default function EditWantedBookPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const { data: want, isLoading, error } = useQuery({
    queryKey: ["want", id],
    queryFn: () => fetchWant(id),
  });

  const bookId = want?.book?.id;
  const { data: bookWithAuthors } = useBookWithAuthors(bookId);
  const { data: bookWithCategories } = useBookCategories(bookId ?? "");
  const { data: allCategories } = useAllCategories();

  const [bookTitle, setBookTitle] = useState("");
  const [bookSubtitle, setBookSubtitle] = useState("");
  const [bookDescription, setBookDescription] = useState("");
  const [bookLanguageMode, setBookLanguageMode] = useState("en");
  const [bookLanguageCustom, setBookLanguageCustom] = useState("");
  const [languageError, setLanguageError] = useState<string | null>(null);

  const [authorInput, setAuthorInput] = useState("");
  const [selectedAuthors, setSelectedAuthors] = useState<SelectedAuthor[]>([]);
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const authorDropdownRef = useRef<HTMLDivElement>(null);

  const { data: authorResults } = useSearchAuthors(authorInput);
  const createAuthor = useCreateAuthor();
  const updateBook = useUpdateBook();

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!want?.book) return;
    setBookTitle(want.book.title ?? "");
    setBookSubtitle(want.book.subtitle ?? "");
    setBookDescription(want.book.description ?? "");
    const language = want.book.language ?? "en";
    const hasPresetLanguage = languageOptions.some(
      (option) => option.value === language && option.value !== "other"
    );
    if (hasPresetLanguage) {
      setBookLanguageMode(language);
      setBookLanguageCustom("");
    } else {
      setBookLanguageMode("other");
      setBookLanguageCustom(language);
    }
    setLanguageError(null);
  }, [want]);

  useEffect(() => {
    if (bookWithAuthors?.authors) {
      setSelectedAuthors(
        bookWithAuthors.authors.map((author) => ({
          id: author.id,
          name: author.name,
        }))
      );
    }
  }, [bookWithAuthors]);

  useEffect(() => {
    if (bookWithCategories?.categories) {
      setSelectedCategoryIds(
        bookWithCategories.categories.map((category) => category.id)
      );
    }
  }, [bookWithCategories]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        authorDropdownRef.current &&
        !authorDropdownRef.current.contains(event.target as Node)
      ) {
        setShowAuthorDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectExistingAuthor(author: { id: string; name: string }) {
    if (!selectedAuthors.some((candidate) => candidate.id === author.id)) {
      setSelectedAuthors((previous) => [
        ...previous,
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
        (candidate) => candidate.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setSelectedAuthors((previous) => [...previous, { name }]);
    }
    setAuthorInput("");
    setShowAuthorDropdown(false);
  }

  function removeAuthor(index: number) {
    setSelectedAuthors((previous) =>
      previous.filter((_, authorIndex) => authorIndex !== index)
    );
  }

  function toggleSelectedCategory(categoryId: string) {
    setSelectedCategoryIds((previous) =>
      previous.includes(categoryId)
        ? previous.filter((id) => id !== categoryId)
        : [...previous, categoryId]
    );
  }

  function resolveBookLanguage() {
    if (bookLanguageMode === "other") {
      const custom = bookLanguageCustom.trim().toLowerCase();
      if (!custom) return null;
      return custom;
    }
    return bookLanguageMode;
  }

  async function handleSubmit() {
    if (!bookId) return;
    setIsSubmitting(true);
    try {
      const resolvedLanguage = resolveBookLanguage();
      if (!resolvedLanguage) {
        setLanguageError("Language code is required when using custom language.");
        return;
      }
      setLanguageError(null);

      const authorIds: string[] = [];
      for (const author of selectedAuthors) {
        if (author.id) {
          authorIds.push(author.id);
        } else {
          const createdAuthor = await createAuthor.mutateAsync({ name: author.name });
          authorIds.push(createdAuthor.id);
        }
      }

      await updateBook.mutateAsync({
        id: bookId,
        body: {
          title: bookTitle.trim() || undefined,
          subtitle: bookSubtitle.trim() || undefined,
          description: bookDescription.trim() || undefined,
          language: resolvedLanguage,
          authorIds,
          categoryIds: selectedCategoryIds,
        },
      });

      router.push("/my-wants");
    } catch (submitError) {
      console.error("Failed to update wanted book:", submitError);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !want) {
    return (
      <div className="space-y-4">
        <Link href="/my-wants">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to My Wants
          </Button>
        </Link>
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load want."}
        </p>
      </div>
    );
  }

  if (!want.book) {
    return (
      <div className="space-y-4">
        <Link href="/my-wants">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to My Wants
          </Button>
        </Link>
        <p className="text-sm text-muted-foreground">
          This want is missing linked book details and cannot be edited.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/my-wants">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Wanted Book</h1>
          <p className="text-muted-foreground">
            Update details for the book in your want list.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Book Details</CardTitle>
          <CardDescription>
            These edits update the shared catalog book information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Book Title</Label>
            <Input
              value={bookTitle}
              onChange={(event) => setBookTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Subtitle</Label>
            <Input
              placeholder="Enter subtitle (optional)..."
              value={bookSubtitle}
              onChange={(event) => setBookSubtitle(event.target.value)}
            />
          </div>

          <div className="space-y-2" ref={authorDropdownRef}>
            <Label>Author(s)</Label>
            {selectedAuthors.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedAuthors.map((author, index) => (
                  <Badge key={`${author.id ?? "new"}-${author.name}-${index}`} variant="secondary" className="gap-1 pr-1">
                    {author.name}
                    {!author.id && (
                      <span className="text-xs text-muted-foreground">(new)</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAuthor(index)}
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
                onChange={(event) => {
                  setAuthorInput(event.target.value);
                  setShowAuthorDropdown(true);
                }}
                onFocus={() => setShowAuthorDropdown(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addNewAuthor();
                  }
                }}
              />
              {showAuthorDropdown && authorInput.length >= 2 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                  {authorResults && authorResults.length > 0 && (
                    <div className="max-h-[150px] overflow-y-auto">
                      {authorResults.map((author) => (
                        <button
                          key={author.id}
                          type="button"
                          onClick={() => selectExistingAuthor(author)}
                          className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent"
                        >
                          {author.name}
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
              onChange={(event) => setBookDescription(event.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Categories</Label>
            {!allCategories?.length ? (
              <p className="text-sm text-muted-foreground">No categories available.</p>
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

          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={bookLanguageMode}
              onValueChange={(value) => {
                setBookLanguageMode(value);
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
            {bookLanguageMode === "other" && (
              <Input
                placeholder="Enter language code, e.g. it"
                value={bookLanguageCustom}
                onChange={(event) => setBookLanguageCustom(event.target.value)}
              />
            )}
            {languageError && (
              <p className="text-sm text-destructive">{languageError}</p>
            )}
          </div>

          {updateBook.isError && (
            <p className="text-sm text-destructive">
              {updateBook.error instanceof Error
                ? updateBook.error.message
                : "Failed to update book details."}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Link href="/my-wants">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !bookTitle.trim()}
              className="gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Book Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
