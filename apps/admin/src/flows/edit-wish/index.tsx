"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminUpdateWish, type CatalogWishRecord } from "@/domain/catalog/queries";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

export function EditWishFlow({
  wish,
  onClose,
}: {
  wish: CatalogWishRecord;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(wish.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useAdminUpdateWish();

  async function handleSave() {
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: wish.id, notes: notes.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Member's notes for this want…"
          rows={5}
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2 border-t border-border/70 pt-4">
        <Button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
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
