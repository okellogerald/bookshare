"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
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
  useCopySearchResults,
  useCreateCopy,
} from "@/shared/queries/my-library";
import { useSubmitCopyRequest } from "@/shared/queries/submissions";

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

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
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedEditionId, setSelectedEditionId] = useState("");
  const [forceManualRequest, setForceManualRequest] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthorsInput, setManualAuthorsInput] = useState("");
  const [manualIsbn, setManualIsbn] = useState("");
  const [manualLanguage, setManualLanguage] = useState("");
  const [manualBookDescriptionNotes, setManualBookDescriptionNotes] = useState("");
  const [condition, setCondition] = useState("unspecified");
  const [shareType, setShareType] = useState("unspecified");
  const [notes, setNotes] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: results, isLoading: searching } = useCopySearchResults(search);
  const createCopy = useCreateCopy();
  const submitCopyRequest = useSubmitCopyRequest();

  const selectedResult =
    (results ?? []).find((result) => result.bookId === selectedBookId) ?? null;

  const showManualForm =
    search.trim().length >= 2 &&
    !searching &&
    ((results?.length ?? 0) === 0 ||
      (!!selectedResult &&
        (selectedResult.editions.length === 0 || forceManualRequest)));

  const manualCardTitle = selectedResult ? "Edition Not Found" : "Book Not Found";
  const manualCardDescription = selectedResult
    ? "This book exists, but the edition is not cataloged yet. Submit the details and the admin will add it for you."
    : "Submit details and the admin will add the edition and copy on your behalf.";

  function resetCopyDetails() {
    setCondition("unspecified");
    setShareType("unspecified");
    setNotes("");
    setContactNote("");
  }

  function resetManualFields() {
    setManualTitle("");
    setManualAuthorsInput("");
    setManualIsbn("");
    setManualLanguage("");
    setManualBookDescriptionNotes("");
  }

  async function handleAddExistingCopy() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedEditionId) {
      setErrorMessage("Choose the edition you want to add.");
      return;
    }

    if (condition === "unspecified") {
      setErrorMessage("Choose the copy condition.");
      return;
    }

    try {
      await createCopy.mutateAsync({
        editionId: selectedEditionId,
        condition,
        shareType: shareType === "unspecified" ? undefined : shareType,
        notes: notes.trim() || undefined,
        contactNote: contactNote.trim() || undefined,
      });
      router.push("/my-library");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not add this copy."
      );
    }
  }

  async function handleSubmitCopyRequest() {
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
      await submitCopyRequest.mutateAsync({
        title,
        authors,
        isbn: manualIsbn.trim() || undefined,
        language: manualLanguage.trim() || undefined,
        bookDescriptionNotes: manualBookDescriptionNotes.trim() || undefined,
        condition: condition === "unspecified" ? undefined : condition,
        shareType: shareType === "unspecified" ? undefined : shareType,
        notes: notes.trim() || undefined,
        contactNote: contactNote.trim() || undefined,
      });

      setSuccessMessage(
        "Copy request sent. You will receive a confirmation email shortly."
      );
      resetManualFields();
      resetCopyDetails();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not submit this copy request."
      );
    }
  }

  function renderCopyDetails(conditionRequired: boolean) {
    return (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>
              Condition{" "}
              {conditionRequired && <span className="text-destructive">*</span>}
            </Label>
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
            {conditionRequired && (
              <p className="text-xs text-muted-foreground">
                A condition is required when you add a cataloged copy directly.
              </p>
            )}
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
          <Label>Copy Notes</Label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Condition details, annotations, missing pages, dust jacket notes..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Use this for details about the physical copy. Do not put contact
            information here.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Contact Note</Label>
          <Textarea
            value={contactNote}
            onChange={(event) => setContactNote(event.target.value)}
            placeholder="Optional listing-specific contact instructions for this copy"
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Your profile contact is the main way people should reach you. Use
            this only when this copy needs different instructions.
          </p>
          <p className="text-xs text-muted-foreground">
            Anything you write here will be visible to everyone on the
            platform.
          </p>
        </div>
      </>
    );
  }

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
            Search the catalog first. If the edition already exists, add your
            copy directly. Otherwise, submit a request for admin processing.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find Existing Edition</CardTitle>
          <CardDescription>
            Search by title, author, or ISBN to check whether your edition is
            already cataloged.
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
                setSelectedEditionId("");
                setForceManualRequest(false);
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

                return (
                  <button
                    key={result.bookId}
                    type="button"
                    onClick={() => {
                      setSelectedBookId(result.bookId);
                      setSelectedEditionId("");
                      setForceManualRequest(false);
                      setErrorMessage(null);
                      setSuccessMessage(null);

                      if (result.editions.length === 0) {
                        setManualTitle((current) => current || result.title);
                        setManualAuthorsInput((current) =>
                          current ||
                          result.authors.map((author) => author.name).join("\n")
                        );
                      }
                    }}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      isSelected ? "border-primary bg-accent/40" : "hover:bg-accent/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{result.title}</p>
                      {result.hasEdition ? (
                        <Badge variant="secondary">Edition in catalog</Badge>
                      ) : (
                        <Badge variant="outline">Book only</Badge>
                      )}
                    </div>
                    {result.subtitle && (
                      <p className="text-sm text-muted-foreground">{result.subtitle}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {result.authors.length
                        ? result.authors.map((author) => author.name).join(", ")
                        : "No authors listed"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.editions.length > 0
                        ? `${result.editions.length} cataloged edition${
                            result.editions.length === 1 ? "" : "s"
                          }`
                        : "No cataloged editions yet"}
                      {/* {result.primaryIsbn ? ` • ISBN ${result.primaryIsbn}` : ""} */}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No matching books found. Submit the details below for admin
              processing.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedResult && selectedResult.editions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Add Selected Edition</CardTitle>
            <CardDescription>
              Choose the exact edition, then enter your copy details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                Edition <span className="text-destructive">*</span>
              </Label>
              <div className="grid gap-2">
                {selectedResult.editions.map((edition) => (
                  <button
                    key={edition.id}
                    type="button"
                    onClick={() => {
                      setSelectedEditionId(edition.id);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className={`rounded border px-3 py-2 text-left text-sm ${
                      selectedEditionId === edition.id
                        ? "border-primary bg-accent/40"
                        : "hover:bg-accent/20"
                    }`}
                  >
                    <span className="font-medium">
                      {formatLabels[edition.format] ?? edition.format}
                    </span>
                    {edition.isbn ? ` • ISBN ${edition.isbn}` : " • ISBN not set"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setForceManualRequest(true);
                  setManualTitle((current) => current || selectedResult.title);
                  setManualAuthorsInput((current) =>
                    current ||
                    selectedResult.authors.map((author) => author.name).join("\n")
                  );
                }}
                className="text-sm text-muted-foreground underline underline-offset-4"
              >
                My edition is not listed
              </button>
            </div>

            {renderCopyDetails(true)}

            <div className="flex justify-end gap-2">
              <Link href="/my-library">
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button
                onClick={handleAddExistingCopy}
                disabled={
                  createCopy.isPending ||
                  !selectedEditionId ||
                  condition === "unspecified"
                }
                className="gap-2"
              >
                {createCopy.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showManualForm && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{manualCardTitle}</CardTitle>
              <CardDescription>{manualCardDescription}</CardDescription>
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
                  onChange={(event) =>
                    setManualBookDescriptionNotes(event.target.value)
                  }
                  placeholder="Anything that can help identify the edition"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Copy Details</CardTitle>
              <CardDescription>
                Add optional details for the admin-managed copy request.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderCopyDetails(false)}

              <div className="flex justify-end gap-2">
                <Link href="/my-library">
                  <Button variant="outline">Cancel</Button>
                </Link>
                <Button
                  onClick={handleSubmitCopyRequest}
                  disabled={submitCopyRequest.isPending}
                  className="gap-2"
                >
                  {submitCopyRequest.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Submit Copy Request
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {successMessage && <p className="text-sm text-emerald-700">{successMessage}</p>}
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
}
