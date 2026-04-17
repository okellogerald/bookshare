"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminUpdateCopy, type CatalogCopyRecord } from "@/domain/catalog/queries";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

export function EditCopyFlow({
  copy,
  onClose,
}: {
  copy: CatalogCopyRecord;
  onClose: () => void;
}) {
  const [condition, setCondition] = useState(copy.condition ?? "");
  const [shareType, setShareType] = useState(copy.share_type ?? "");
  const [notes, setNotes] = useState(copy.notes ?? "");
  const [contactNote, setContactNote] = useState(copy.contact_note ?? "");
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useAdminUpdateCopy();

  async function handleSave() {
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: copy.id,
        condition: condition || undefined,
        shareType: shareType || undefined,
        notes: notes.trim() || undefined,
        contactNote: contactNote.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Condition</Label>
          <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="">— not specified —</option>
            <option value="new">New</option>
            <option value="like_new">Like new</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Share type</Label>
          <Select value={shareType} onChange={(e) => setShareType(e.target.value)}>
            <option value="">— not specified —</option>
            <option value="lend">Lend</option>
            <option value="sell">Sell</option>
            <option value="give_away">Give away</option>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Contact note</Label>
          <Textarea value={contactNote} onChange={(e) => setContactNote(e.target.value)} rows={3} />
        </div>
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
