"use client";

import { useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { useBrowseWants } from "@/shared/queries/wanted";
import { WantCard } from "./want-card";

export default function WantedPage() {
  const [search, setSearch] = useState("");
  const { data: wants, isLoading } = useBrowseWants({ search });

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
            <WantCard key={want.id} want={want} />
          ))}
        </div>
      )}
    </div>
  );
}
