"use client";

import { useState } from "react";
import type { PgBrowseWant } from "@/shared/api";
import { BookDetailsDialog } from "@/shared/components/book-details-dialog";
import { Input } from "@/shared/components/ui/input";
import { useBrowseWants } from "@/shared/queries/wanted";
import { WantCard } from "./want-card";

export default function WantedPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWant, setSelectedWant] = useState<PgBrowseWant | null>(null);
  const { data: wants, isLoading } = useBrowseWants({ search });

  function handleWantSelect(want: PgBrowseWant) {
    setSelectedWant(want);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wanted</h1>
        <p className="text-muted-foreground">
          Books that community members are looking for
        </p>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search by book title..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !wants?.length ? (
        <p className="text-muted-foreground">No wanted books found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wants.map((want) => (
            <WantCard key={want.id} want={want} onSelect={handleWantSelect} />
          ))}
        </div>
      )}

      <BookDetailsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bookId={selectedWant?.book_id ?? null}
        fallbackTitle={selectedWant?.book_title}
        fallbackSubtitle={selectedWant?.book_subtitle}
      >
        {selectedWant?.notes && (
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Want notes
            </p>
            <p className="mt-1 text-sm">{selectedWant.notes}</p>
          </div>
        )}
      </BookDetailsDialog>
    </div>
  );
}
