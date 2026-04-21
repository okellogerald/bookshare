"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BookstoreStatus } from "@bookshare/shared";
import {
  useBookstore,
  useResubmitBookstore,
  useUpdateBookstore,
} from "@/domain/bookstores/queries";
import { BookstoreStatusBanner } from "@/shared/components/bookstore-status";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

const emptyForm = {
  name: "",
  websiteUrl: "",
  phone: "",
  email: "",
  whatsapp: "",
  instagram: "",
  address: "",
  contactNote: "",
};

export default function BookstoreProfilePage() {
  const params = useParams<{ bookstoreId: string }>();
  const bookstoreId = params.bookstoreId;
  const bookstoreQuery = useBookstore(bookstoreId);
  const updateBookstore = useUpdateBookstore(bookstoreId);
  const resubmitBookstore = useResubmitBookstore(bookstoreId);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!bookstoreQuery.data) return;

    setForm({
      name: bookstoreQuery.data.name ?? "",
      websiteUrl: bookstoreQuery.data.websiteUrl ?? "",
      phone: bookstoreQuery.data.phone ?? "",
      email: bookstoreQuery.data.email ?? "",
      whatsapp: bookstoreQuery.data.whatsapp ?? "",
      instagram: bookstoreQuery.data.instagram ?? "",
      address: bookstoreQuery.data.address ?? "",
      contactNote: bookstoreQuery.data.contactNote ?? "",
    });
  }, [bookstoreQuery.data]);

  if (bookstoreQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading bookstore…
      </div>
    );
  }

  if (bookstoreQuery.error || !bookstoreQuery.data) {
    return (
      <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {(bookstoreQuery.error as Error | null)?.message || "Bookstore not found."}
      </div>
    );
  }

  const bookstore = bookstoreQuery.data;
  const canEdit = bookstore.canManageMembers;
  const errorMessage =
    (updateBookstore.error as Error | null)?.message ||
    (resubmitBookstore.error as Error | null)?.message ||
    null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateBookstore.mutateAsync(form);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.04em]">
          Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Public contact details readers see after you send a proposal."
            : "Public contact details readers see after a proposal is sent. Only owners can edit."}
        </p>
      </div>

      <BookstoreStatusBanner status={bookstore.status} reviewNote={bookstore.reviewNote} />

      {errorMessage ? (
        <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            disabled={!canEdit}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website</Label>
            <Input
              id="websiteUrl"
              value={form.websiteUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  websiteUrl: event.target.value,
                }))
              }
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              value={form.whatsapp}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  whatsapp: event.target.value,
                }))
              }
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              value={form.instagram}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  instagram: event.target.value,
                }))
              }
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactNote">Contact note</Label>
          <Textarea
            id="contactNote"
            rows={5}
            value={form.contactNote}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                contactNote: event.target.value,
              }))
            }
            disabled={!canEdit}
          />
        </div>

        {canEdit ? (
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={updateBookstore.isPending}>
              {updateBookstore.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save changes"
              )}
            </Button>
            {bookstore.status === BookstoreStatus.REJECTED ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => resubmitBookstore.mutateAsync()}
                disabled={resubmitBookstore.isPending}
              >
                {resubmitBookstore.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resubmitting
                  </>
                ) : (
                  "Resubmit for review"
                )}
              </Button>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
