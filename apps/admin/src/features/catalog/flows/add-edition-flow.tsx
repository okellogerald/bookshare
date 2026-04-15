"use client";

import { NewBookForm } from "@/features/catalog/components/new-book-form";

export function AddEditionFlow({ onClose }: { onClose: () => void }) {
  return <NewBookForm surface="plain" onClose={onClose} onCreated={onClose} />;
}
