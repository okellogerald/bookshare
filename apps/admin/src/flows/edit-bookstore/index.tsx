"use client";

import { useState } from "react";
import type { AdminBookstoreDetail } from "@bookshare/shared";
import { useAdminUpdateBookstore } from "@/domain/bookstores/queries";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

interface FormState {
  name: string;
  websiteUrl: string;
  phone: string;
  email: string;
  whatsapp: string;
  instagram: string;
  address: string;
  contactNote: string;
}

function toInitialState(bookstore: AdminBookstoreDetail): FormState {
  return {
    name: bookstore.name,
    websiteUrl: bookstore.websiteUrl ?? "",
    phone: bookstore.phone ?? "",
    email: bookstore.email ?? "",
    whatsapp: bookstore.whatsapp ?? "",
    instagram: bookstore.instagram ?? "",
    address: bookstore.address ?? "",
    contactNote: bookstore.contactNote ?? "",
  };
}

function diffField(next: string, previous: string | null): string | undefined {
  const trimmed = next.trim();
  const prev = previous ?? "";
  if (trimmed === prev) return undefined;
  if (trimmed.length === 0) return undefined;
  return trimmed;
}

export function EditBookstoreFlow({
  bookstore,
  onClose,
}: {
  bookstore: AdminBookstoreDetail;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toInitialState(bookstore));
  const updateBookstore = useAdminUpdateBookstore(bookstore.id);

  const canSubmit = form.name.trim().length > 0 && !updateBookstore.isPending;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const name = form.name.trim();
    const payload: Parameters<typeof updateBookstore.mutateAsync>[0] = {};

    if (name !== bookstore.name) payload.name = name;

    const websiteUrl = diffField(form.websiteUrl, bookstore.websiteUrl);
    if (websiteUrl !== undefined) payload.websiteUrl = websiteUrl;

    const phone = diffField(form.phone, bookstore.phone);
    if (phone !== undefined) payload.phone = phone;

    const email = diffField(form.email, bookstore.email);
    if (email !== undefined) payload.email = email;

    const whatsapp = diffField(form.whatsapp, bookstore.whatsapp);
    if (whatsapp !== undefined) payload.whatsapp = whatsapp;

    const instagram = diffField(form.instagram, bookstore.instagram);
    if (instagram !== undefined) payload.instagram = instagram;

    const address = diffField(form.address, bookstore.address);
    if (address !== undefined) payload.address = address;

    const contactNote = diffField(form.contactNote, bookstore.contactNote);
    if (contactNote !== undefined) payload.contactNote = contactNote;

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    await updateBookstore.mutateAsync(payload);
    onClose();
  };

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-bookstore-name">Name</Label>
          <Input
            id="edit-bookstore-name"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            required
            maxLength={255}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-bookstore-website">Website</Label>
            <Input
              id="edit-bookstore-website"
              value={form.websiteUrl}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, websiteUrl: event.target.value }))
              }
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-bookstore-phone">Phone</Label>
            <Input
              id="edit-bookstore-phone"
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-bookstore-email">Public email</Label>
            <Input
              id="edit-bookstore-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-bookstore-whatsapp">WhatsApp</Label>
            <Input
              id="edit-bookstore-whatsapp"
              value={form.whatsapp}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, whatsapp: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-bookstore-instagram">Instagram</Label>
            <Input
              id="edit-bookstore-instagram"
              value={form.instagram}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, instagram: event.target.value }))
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-bookstore-address">Address</Label>
          <Textarea
            id="edit-bookstore-address"
            rows={2}
            value={form.address}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, address: event.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-bookstore-contact-note">Contact note</Label>
          <Textarea
            id="edit-bookstore-contact-note"
            rows={2}
            value={form.contactNote}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, contactNote: event.target.value }))
            }
          />
        </div>
      </section>

      {updateBookstore.isError ? (
        <p className="text-sm text-red-700">
          {updateBookstore.error instanceof Error
            ? updateBookstore.error.message
            : "Failed to update bookstore."}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t pt-5">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={updateBookstore.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {updateBookstore.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
