"use client";

import { useMemo, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { useBrowseWants } from "@/shared/queries/wanted";
import { useQuotesByBooks } from "@/shared/queries/quotes";
import { WantCard } from "./want-card";

export default function WantedPage() {
  const [search, setSearch] = useState("");
  const { data: wants, isLoading } = useBrowseWants({ search });

  // Collect unique book IDs
  const bookIds = useMemo(
    () => [...new Set(wants?.map((w) => w.book_id) ?? [])],
    [wants]
  );

  const { data: allQuotes } = useQuotesByBooks(bookIds);

  // Build a map of bookId → random quote text
  const quoteMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!allQuotes) return map;

    const byBook = new Map<string, string[]>();
    for (const q of allQuotes) {
      const arr = byBook.get(q.book_id) ?? [];
      arr.push(q.text);
      byBook.set(q.book_id, arr);
    }
    for (const [bookId, texts] of byBook) {
      map.set(bookId, texts[Math.floor(Math.random() * texts.length)]);
    }
    return map;
  }, [allQuotes]);

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
          onChange={(e) => setSearch(e.target.value)}
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
            <WantCard
              key={want.id}
              want={want}
              quote={quoteMap.get(want.book_id)}
            />
          ))}
        </div>
      )}

    </div>
  );
}
