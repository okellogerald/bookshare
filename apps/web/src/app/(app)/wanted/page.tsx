"use client";

import { useEffect, useMemo, useState } from "react";
import type { PgBrowseWant } from "@/shared/api";
import { BookDetailsDialog } from "@/shared/components/book-details-dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useCurrentUser } from "@/shared/providers/user-provider";
import { useBrowseWants } from "@/shared/queries/wanted";
import { WantCard } from "./want-card";

export default function WantedPage() {
  const currentUser = useCurrentUser();
  const [search, setSearch] = useState("");
  const [includeMyWants, setIncludeMyWants] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWant, setSelectedWant] = useState<PgBrowseWant | null>(null);
  const { data: wants, isLoading } = useBrowseWants({ search });
  const filteredWants = useMemo(() => {
    if (!wants) return [];
    if (includeMyWants || !currentUser?.id) return wants;

    return wants.filter(
      (want) =>
        !want.wanters.some((wanter) => wanter.user_id === currentUser.id)
    );
  }, [wants, includeMyWants, currentUser?.id]);

  const selectedWantFromFiltered = selectedWant
    ? filteredWants.find((want) => want.book_id === selectedWant.book_id) ?? null
    : null;

  useEffect(() => {
    if (dialogOpen && selectedWant && !selectedWantFromFiltered) {
      setDialogOpen(false);
      setSelectedWant(null);
    }
  }, [dialogOpen, selectedWant, selectedWantFromFiltered]);

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

      <div className="flex flex-wrap gap-4">
        <Input
          placeholder="Search by book title..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        <Button
          type="button"
          variant={includeMyWants ? "default" : "outline"}
          onClick={() => setIncludeMyWants((current) => !current)}
        >
          {includeMyWants ? "Hide My Wants" : "Show My Wants"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !filteredWants.length ? (
        <p className="text-muted-foreground">No wanted books found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWants.map((want) => (
            <WantCard key={want.book_id} want={want} onSelect={handleWantSelect} />
          ))}
        </div>
      )}

      <BookDetailsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bookId={selectedWantFromFiltered?.book_id ?? null}
        fallbackTitle={selectedWantFromFiltered?.book_title}
        fallbackSubtitle={selectedWantFromFiltered?.book_subtitle}
      >
        {selectedWantFromFiltered && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Community wanters ({selectedWantFromFiltered.want_count})
            </p>
            <div className="space-y-2">
              {selectedWantFromFiltered.wanters.map((wanter) => (
                <div key={wanter.user_id} className="rounded border p-2">
                  <p className="text-sm font-medium">
                    @{wanter.username ?? "member"}
                    {wanter.display_name ? ` • ${wanter.display_name}` : ""}
                  </p>
                  {wanter.notes ? (
                    <p className="text-sm text-muted-foreground">{wanter.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No note provided.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </BookDetailsDialog>
    </div>
  );
}
