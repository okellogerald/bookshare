"use client";

import { useState } from "react";
import type { AdminBookstoreCreateResult } from "@bookshare/shared";
import { useAdminCreateBookstore } from "@/domain/bookstores/queries";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

interface FormState {
  name: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  websiteUrl: string;
  phone: string;
  email: string;
  whatsapp: string;
  instagram: string;
  address: string;
  contactNote: string;
}

const INITIAL_STATE: FormState = {
  name: "",
  ownerEmail: "",
  ownerFirstName: "",
  ownerLastName: "",
  websiteUrl: "",
  phone: "",
  email: "",
  whatsapp: "",
  instagram: "",
  address: "",
  contactNote: "",
};

function toOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function CreateBookstoreFlow({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [result, setResult] = useState<AdminBookstoreCreateResult | null>(null);
  const createBookstore = useAdminCreateBookstore();

  const canSubmit =
    form.name.trim().length > 0 &&
    form.ownerEmail.trim().length > 0 &&
    form.ownerFirstName.trim().length > 0 &&
    form.ownerLastName.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const payload = {
      name: form.name.trim(),
      ownerEmail: form.ownerEmail.trim(),
      ownerFirstName: form.ownerFirstName.trim(),
      ownerLastName: form.ownerLastName.trim(),
      websiteUrl: toOptional(form.websiteUrl),
      phone: toOptional(form.phone),
      email: toOptional(form.email),
      whatsapp: toOptional(form.whatsapp),
      instagram: toOptional(form.instagram),
      address: toOptional(form.address),
      contactNote: toOptional(form.contactNote),
    };

    const created = await createBookstore.mutateAsync(payload);
    setResult(created);
  };

  if (result) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {result.bookstore.name} created
          </p>
          <p className="text-sm text-muted-foreground">
            The bookstore is pending the owner&apos;s first sign-in. A
            temporary password was generated for{" "}
            <span className="font-medium text-foreground">
              {result.owner.email}
            </span>
            .
          </p>
        </div>

        <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
          {result.emailSent ? (
            <p className="text-foreground">
              An email with sign-in credentials was sent to{" "}
              <span className="font-medium">{result.owner.email}</span>. You can
              resend or update the owner from the bookstore detail panel while
              it&apos;s still pending.
            </p>
          ) : (
            <p className="text-amber-700">
              SMTP is not configured, so we couldn&apos;t email the temporary
              password. Use the &ldquo;Resend owner email&rdquo; action once
              SMTP is set up.
            </p>
          )}
        </div>

        <div className="flex justify-end border-t pt-5">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Bookstore
        </h3>
        <div className="space-y-2">
          <Label htmlFor="bookstore-name">Name</Label>
          <Input
            id="bookstore-name"
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
            <Label htmlFor="bookstore-website">Website</Label>
            <Input
              id="bookstore-website"
              value={form.websiteUrl}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, websiteUrl: event.target.value }))
              }
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bookstore-phone">Phone</Label>
            <Input
              id="bookstore-phone"
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bookstore-email">Public email</Label>
            <Input
              id="bookstore-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bookstore-whatsapp">WhatsApp</Label>
            <Input
              id="bookstore-whatsapp"
              value={form.whatsapp}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, whatsapp: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bookstore-instagram">Instagram</Label>
            <Input
              id="bookstore-instagram"
              value={form.instagram}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, instagram: event.target.value }))
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bookstore-address">Address</Label>
          <Textarea
            id="bookstore-address"
            rows={2}
            value={form.address}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, address: event.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bookstore-contact-note">Contact note</Label>
          <Textarea
            id="bookstore-contact-note"
            rows={2}
            value={form.contactNote}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, contactNote: event.target.value }))
            }
          />
        </div>
      </section>

      <section className="space-y-4 border-t pt-5">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">
            Owner admin
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll create an Ory identity and email the owner a temporary
            password they can change after signing in.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="owner-first">First name</Label>
            <Input
              id="owner-first"
              value={form.ownerFirstName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  ownerFirstName: event.target.value,
                }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner-last">Last name</Label>
            <Input
              id="owner-last"
              value={form.ownerLastName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  ownerLastName: event.target.value,
                }))
              }
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner-email">Email</Label>
          <Input
            id="owner-email"
            type="email"
            value={form.ownerEmail}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, ownerEmail: event.target.value }))
            }
            required
          />
        </div>
      </section>

      {createBookstore.isError ? (
        <p className="text-sm text-red-700">
          {createBookstore.error instanceof Error
            ? createBookstore.error.message
            : "Failed to create bookstore."}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t pt-5">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={createBookstore.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || createBookstore.isPending}>
          {createBookstore.isPending ? "Creating..." : "Create bookstore"}
        </Button>
      </div>
    </form>
  );
}
