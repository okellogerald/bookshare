"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import {
  useAdminUpdateBook,
  useAuthorSearch,
  useCreateAuthor,
} from "@/domain/catalog/queries";
import type { PgBookWithAuthorsView } from "@/shared/api";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function EditBookFlow({
  book,
  onClose,
}: {
  book: PgBookWithAuthorsView;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [subtitle, setSubtitle] = useState(book.subtitle ?? "");
  const [language, setLanguage] = useState(book.language ?? "en");
  const [authorIds, setAuthorIds] = useState<string[]>(book.authors.map((a) => a.id));
  const [authorNames, setAuthorNames] = useState<string[]>(book.authors.map((a) => a.name));
  const [authorSearch, setAuthorSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const authorSearchQuery = useAuthorSearch(authorSearch);
  const authorResults = authorSearchQuery.data ?? [];
  const createAuthorMutation = useCreateAuthor();
  const updateMutation = useAdminUpdateBook();

  function addAuthor(id: string, name: string) {
    if (!authorIds.includes(id)) {
      setAuthorIds((prev) => [...prev, id]);
      setAuthorNames((prev) => [...prev, name]);
    }
    setAuthorSearch("");
  }

  function removeAuthor(index: number) {
    setAuthorIds((prev) => prev.filter((_, i) => i !== index));
    setAuthorNames((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateAuthor() {
    if (!authorSearch.trim()) return;
    try {
      const result = await createAuthorMutation.mutateAsync(authorSearch.trim());
      addAuthor(result.id, result.name);
    } catch {
      // silently ignored
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: book.id,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        language: language.trim() || undefined,
        authorIds,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label>Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Subtitle</Label>
          <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Language</Label>
          <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="en" />
        </div>

        <div className="space-y-2">
          <Label>Authors</Label>
          {authorNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {authorNames.map((name, i) => (
                <Badge key={i} variant="secondary" className="gap-1 border border-border/75">
                  {name}
                  <button type="button" onClick={() => removeAuthor(i)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={authorSearch}
              onChange={(e) => setAuthorSearch(e.target.value)}
              placeholder="Search or create author…"
              className="flex-1"
            />
            {authorSearch.trim().length >= 2 &&
              authorResults.length === 0 &&
              !authorSearchQuery.isLoading && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateAuthor}
                  className="shrink-0 gap-1"
                  disabled={createAuthorMutation.isPending}
                >
                  <Plus className="h-3 w-3" />
                  Create
                </Button>
              )}
          </div>
          {authorSearch.trim().length >= 2 && authorResults.length > 0 && (
            <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-md border border-border/70 p-1">
              {authorResults.map((author) => (
                <button
                  key={author.id}
                  type="button"
                  onClick={() => addAuthor(author.id, author.name)}
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                >
                  {author.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2 border-t border-border/70 pt-4">
        <Button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
