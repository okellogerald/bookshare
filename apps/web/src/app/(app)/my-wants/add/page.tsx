"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { useCreateWant, useMyWants, useWantSearchResults } from "@/shared/queries/my-wants";
import { useMyActiveOwnedBookIds } from "@/shared/queries/my-library";
import { useSubmitMissingWantRequest } from "@/shared/queries/submissions";

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

export default function AddWantPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [foundBookNotes, setFoundBookNotes] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthorsInput, setManualAuthorsInput] = useState("");
  const [manualIsbn, setManualIsbn] = useState("");
  const [manualLanguage, setManualLanguage] = useState("");
  const [manualBookDescriptionNotes, setManualBookDescriptionNotes] = useState("");
  const [manualWantNotes, setManualWantNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: results, isLoading: searching } = useWantSearchResults(search);
  const { data: myWants } = useMyWants();
  const { data: myActiveOwnedBookIds } = useMyActiveOwnedBookIds();
  const createWant = useCreateWant();
  const submitMissingWantRequest = useSubmitMissingWantRequest();

  const activeWantBookIds = useMemo(
    () =>
      new Set(
        (myWants ?? [])
          .filter((want) => want.status === "active")
          .map((want) => want.book_id)
      ),
    [myWants]
  );

  const activeOwnedBookIds = useMemo(
    () => new Set(myActiveOwnedBookIds ?? []),
    [myActiveOwnedBookIds]
  );

  const selectedResult = (results ?? []).find((result) => result.bookId === selectedBookId) ?? null;
  const alreadyInMyWants = selectedResult
    ? activeWantBookIds.has(selectedResult.bookId)
    : false;
  const alreadyInMyLibrary = selectedResult
    ? activeOwnedBookIds.has(selectedResult.bookId)
    : false;

  async function handleAddExistingWant() {
    if (!selectedResult) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (alreadyInMyWants) {
      setErrorMessage("This book is already in your wants list.");
      return;
    }

    if (alreadyInMyLibrary) {
      setErrorMessage("This book is already in your library.");
      return;
    }

    try {
      await createWant.mutateAsync({
        bookId: selectedResult.bookId,
        notes: foundBookNotes.trim() || undefined,
      });
      router.push("/my-wants");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not add this want."
      );
    }
  }

  async function handleSubmitMissingWant() {
    setErrorMessage(null);
    setSuccessMessage(null);

    const title = manualTitle.trim();
    const authors = parseAuthors(manualAuthorsInput);

    if (!title) {
      setErrorMessage("Book title is required.");
      return;
    }

    if (authors.length === 0) {
      setErrorMessage("At least one author is required.");
      return;
    }

    try {
      await submitMissingWantRequest.mutateAsync({
        title,
        authors,
        isbn: manualIsbn.trim() || undefined,
        language: manualLanguage.trim() || undefined,
        bookDescriptionNotes: manualBookDescriptionNotes.trim() || undefined,
        wantNotes: manualWantNotes.trim() || undefined,
      });

      setSuccessMessage(
        "Want request sent. You will receive a confirmation email shortly."
      );
      setManualTitle("");
      setManualAuthorsInput("");
      setManualIsbn("");
      setManualLanguage("");
      setManualBookDescriptionNotes("");
      setManualWantNotes("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not submit the missing-book request."
      );
    }
  }

  const showManualForm =
    search.trim().length >= 2 && !searching && (results?.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add Want</h1>
        <p className="text-muted-foreground">
          Search books already in the system first. If not found, submit a manual request.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find Existing Book</CardTitle>
          <CardDescription>
            Search by title, author, or ISBN.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedBookId(null);
                setFoundBookNotes("");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="pl-9"
              placeholder="Type at least 2 characters..."
            />
          </div>

          {search.trim().length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Enter at least 2 characters to search.
            </p>
          ) : searching ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </p>
          ) : results && results.length > 0 ? (
            <div className="grid gap-3">
              {results.map((result) => {
                const isSelected = selectedBookId === result.bookId;
                const isAlreadyWanted = activeWantBookIds.has(result.bookId);
                const isAlreadyOwned = activeOwnedBookIds.has(result.bookId);
                return (
                  <button
                    key={result.bookId}
                    type="button"
                    onClick={() => {
                      setSelectedBookId(result.bookId);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      isSelected ? "border-primary bg-accent/40" : "hover:bg-accent/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{result.title}</p>
                      {result.hasCommunityCopy ? (
                        <Badge>Community copy exists</Badge>
                      ) : result.hasEdition ? (
                        <Badge variant="secondary">Edition in catalog</Badge>
                      ) : (
                        <Badge variant="outline">Catalog record</Badge>
                      )}
                      {isAlreadyWanted && <Badge variant="outline">Already wanted</Badge>}
                      {isAlreadyOwned && <Badge variant="outline">In your library</Badge>}
                    </div>
                    {result.subtitle && (
                      <p className="text-sm text-muted-foreground">{result.subtitle}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {result.authors.length
                        ? result.authors.map((author) => author.name).join(", ")
                        : "No authors listed"}
                    </p>
                    {result.primaryIsbn && (
                      <p className="text-xs text-muted-foreground">
                        ISBN: {result.primaryIsbn}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedResult && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Add selected book to your wants</p>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={foundBookNotes}
                  onChange={(event) => setFoundBookNotes(event.target.value)}
                  placeholder="Anything to tell lenders or sellers"
                />
              </div>
              <Button
                onClick={handleAddExistingWant}
                disabled={
                  createWant.isPending || alreadyInMyWants || alreadyInMyLibrary
                }
              >
                {createWant.isPending ? "Adding..." : "Add to My Wants"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showManualForm && (
        <Card>
          <CardHeader>
            <CardTitle>Book Not Found</CardTitle>
            <CardDescription>
              Submit details and the admin will add the edition and want on your behalf.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                Book Title <span className="text-destructive">*</span>
              </Label>
              <Input
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                placeholder="Book title"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Author(s) <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={manualAuthorsInput}
                onChange={(event) => setManualAuthorsInput(event.target.value)}
                placeholder="One per line or comma-separated"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>ISBN</Label>
                <Input
                  value={manualIsbn}
                  onChange={(event) => setManualIsbn(event.target.value)}
                  placeholder="Optional ISBN"
                />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Input
                  value={manualLanguage}
                  onChange={(event) => setManualLanguage(event.target.value)}
                  placeholder="e.g. en, sw"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Book Description Notes</Label>
              <Textarea
                value={manualBookDescriptionNotes}
                onChange={(event) => setManualBookDescriptionNotes(event.target.value)}
                placeholder="Any other identifiers"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Want Notes</Label>
              <Textarea
                value={manualWantNotes}
                onChange={(event) => setManualWantNotes(event.target.value)}
                placeholder="Anything to say to lenders or sellers"
                rows={3}
              />
            </div>

            <Button
              onClick={handleSubmitMissingWant}
              disabled={submitMissingWantRequest.isPending}
            >
              {submitMissingWantRequest.isPending ? "Submitting..." : "Submit Want Request"}
            </Button>
          </CardContent>
        </Card>
      )}

      {successMessage && <p className="text-sm text-emerald-700">{successMessage}</p>}
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
}
