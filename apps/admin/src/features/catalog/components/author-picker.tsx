"use client";

import { useDeferredValue, useState } from "react";
import { Loader2, Plus, UserPlus, X } from "lucide-react";
import {
  useAuthorSearch,
  useCreateAuthor,
  type AuthorRecord,
} from "@/shared/queries/catalog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

interface AuthorPickerProps {
  selected: AuthorRecord[];
  onChange: (authors: AuthorRecord[]) => void;
}

export function AuthorPicker({ selected, onChange }: AuthorPickerProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const authorsQuery = useAuthorSearch(deferredQuery);
  const createAuthor = useCreateAuthor();

  const results = authorsQuery.data ?? [];
  const selectedIds = new Set(selected.map((a) => a.id));
  const showDropdown = deferredQuery.trim().length >= 2;

  // Filter out already-selected authors from results
  const filteredResults = results.filter((a) => !selectedIds.has(a.id));

  // Check if the typed name matches an existing result exactly
  const trimmedQuery = query.trim();
  const exactMatch = results.some(
    (a) => a.name.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const alreadySelected = selected.some(
    (a) => a.name.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const canCreateNew =
    trimmedQuery.length >= 2 && !exactMatch && !alreadySelected;

  function addAuthor(author: AuthorRecord) {
    if (!selectedIds.has(author.id)) {
      onChange([...selected, author]);
    }
    setQuery("");
  }

  function removeAuthor(id: string) {
    onChange(selected.filter((a) => a.id !== id));
  }

  async function handleCreateAuthor() {
    try {
      const author = await createAuthor.mutateAsync(trimmedQuery);
      addAuthor(author);
    } catch {
      // Error handled by mutation state
    }
  }

  return (
    <div className="space-y-2">
      <Label>Authors *</Label>

      {/* Selected authors */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((author) => (
            <Badge
              key={author.id}
              variant="secondary"
              className="gap-1 border border-border/75 bg-background pl-3 pr-1.5 py-1"
            >
              {author.name}
              <button
                type="button"
                onClick={() => removeAuthor(author.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search authors by name..."
        />

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card shadow-lg">
            {authorsQuery.isLoading ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching...
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto py-1">
                {filteredResults.map((author) => (
                  <button
                    key={author.id}
                    type="button"
                    onClick={() => addAuthor(author)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {author.name}
                  </button>
                ))}

                {filteredResults.length === 0 && !canCreateNew && (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    {alreadySelected
                      ? "Author already selected."
                      : "No authors found."}
                  </p>
                )}

                {canCreateNew && (
                  <>
                    {filteredResults.length > 0 && (
                      <div className="mx-3 border-t border-border" />
                    )}
                    <button
                      type="button"
                      onClick={handleCreateAuthor}
                      disabled={createAuthor.isPending}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-primary hover:bg-muted disabled:opacity-50"
                    >
                      {createAuthor.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      Create &ldquo;{trimmedQuery}&rdquo;
                    </button>
                  </>
                )}
              </div>
            )}

            {createAuthor.isError && (
              <p className="border-t border-border px-4 py-2 text-xs text-red-700">
                {createAuthor.error instanceof Error
                  ? createAuthor.error.message
                  : "Failed to create author."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
