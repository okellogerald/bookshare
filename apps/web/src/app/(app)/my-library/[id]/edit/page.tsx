"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CopyStatusTransitionFields } from "@/shared/components/copy-status-transition-fields";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { useUpdateCopy, useUpdateCopyStatus } from "@/domains/library/queries";
import type { PgCopyDetail } from "@/shared/api";
import {
  buildStatusTransitionBody,
  createStatusTransitionFormState,
  getApiErrorMessage,
  getDefaultGoneReason,
  getStatusTransitionValidationMessage,
  shareTypeLabels,
  statusLabels,
  type LibraryCopyStatus,
  type StatusTransitionFormState,
} from "@/shared/lib/copy-status";

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

async function fetchCopy(id: string): Promise<PgCopyDetail> {
  const params = new URLSearchParams();
  params.set("id", `eq.${id}`);
  params.set("select", "*,edition:editions(*,book:books(*))");

  const response = await fetch(`/api/backend/copies?${params}`);
  if (!response.ok) throw new Error("Failed to fetch copy");
  const json = await response.json();
  if (!json.data?.[0]) throw new Error("Copy not found");
  return json.data[0];
}

export default function EditCopyPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [condition, setCondition] = useState("");
  const [status, setStatus] = useState("");
  const [shareType, setShareType] = useState("");
  const [statusTransition, setStatusTransition] =
    useState<StatusTransitionFormState>(() =>
      createStatusTransitionFormState("available", null)
    );
  const [notes, setNotes] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);

  const { data: copy, isLoading } = useQuery({
    queryKey: ["copy", id],
    queryFn: () => fetchCopy(id),
  });
  const updateCopy = useUpdateCopy();
  const updateCopyStatus = useUpdateCopyStatus();

  useEffect(() => {
    if (!copy) return;
    setCondition(copy.condition ?? "good");
    setStatus(copy.status ?? "available");
    setShareType(copy.share_type ?? "");
    setStatusTransition(
      createStatusTransitionFormState(
        (copy.status ?? "available") as LibraryCopyStatus,
        copy.share_type
      )
    );
    setNotes(copy.notes ?? "");
    setContactNote(copy.contact_note ?? "");
    setStatusError(null);
  }, [copy]);

  useEffect(() => {
    if (statusTransition.targetStatus !== "gone" || statusTransition.goneReason) {
      return;
    }

    setStatusTransition((current) => ({
      ...current,
      goneReason: getDefaultGoneReason(shareType),
    }));
  }, [shareType, statusTransition.goneReason, statusTransition.targetStatus]);

  async function handleSubmit() {
    const statusChanged = !!copy && status !== copy.status;
    const validationMessage = statusChanged
      ? getStatusTransitionValidationMessage(statusTransition)
      : null;

    if (validationMessage) {
      setStatusError(validationMessage);
      return;
    }

    await updateCopy.mutateAsync({
      id,
      body: {
        condition: condition || undefined,
        shareType: shareType || undefined,
        notes: notes.trim() || undefined,
        contactNote: contactNote.trim() || undefined,
      },
    });

    if (statusChanged) {
      try {
        await updateCopyStatus.mutateAsync({
          id,
          body: buildStatusTransitionBody(statusTransition),
        });
      } catch (error) {
        setStatusError(
          getApiErrorMessage(error, "Failed to update the copy status.")
        );
        return;
      }
    }

    router.push("/my-library");
  }

  const statusChanged = !!copy && status !== copy.status;
  const statusValidationMessage = statusChanged
    ? getStatusTransitionValidationMessage(statusTransition)
    : null;
  const displayedStatusMessage = statusError ?? statusValidationMessage;
  const hasStatusError = !!statusError;

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/my-library">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Copy</h1>
          <p className="text-muted-foreground">
            {copy?.edition?.book?.title ?? "Copy"}
            {copy?.edition?.isbn ? ` (ISBN: ${copy.edition.isbn})` : ""}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Copy Details</CardTitle>
          <CardDescription>
            Edit status, condition, share type, copy notes, and contact notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setStatusError(null);
                  setStatusTransition(
                    createStatusTransitionFormState(
                      value as LibraryCopyStatus,
                      shareType || copy?.share_type
                    )
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="like_new">Like New</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Share Type</Label>
            <Select
              value={shareType}
              onValueChange={(value) => {
                setShareType(value);
                setStatusError(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(shareTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {statusChanged && (
            <div className="space-y-2">
              <Label>Status change details</Label>
              <CopyStatusTransitionFields
                bookId={copy?.edition?.book?.id ?? null}
                values={statusTransition}
                onChange={(patch) => {
                  setStatusError(null);
                  setStatusTransition((current) => ({
                    ...current,
                    ...patch,
                  }));
                }}
              />
              {displayedStatusMessage ? (
                <p
                  className={`text-sm ${
                    hasStatusError ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {displayedStatusMessage}
                </p>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label>Copy Notes</Label>
            <Textarea
              placeholder="Condition details, annotations, missing pages, dust jacket notes..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use this for details about the physical copy. Do not put contact
              information here.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Contact Note</Label>
            <Textarea
              placeholder="Optional listing-specific contact instructions for this copy..."
              value={contactNote}
              onChange={(event) => setContactNote(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your profile contact is the main way people should reach you. Use
              this only when this copy needs different instructions.
            </p>
            <p className="text-xs text-muted-foreground">
              Anything you write here will be visible to everyone on the
              platform.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/my-library">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              onClick={handleSubmit}
              disabled={
                updateCopy.isPending ||
                updateCopyStatus.isPending ||
                !!statusValidationMessage
              }
              className="gap-2"
            >
              {(updateCopy.isPending || updateCopyStatus.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Book &amp; Edition Details</CardTitle>
          <CardDescription>
            Book and edition fields are read-only on this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Title:</span>{" "}
            {copy?.edition?.book?.title ?? "—"}
          </p>
          {copy?.edition?.book?.subtitle && (
            <p>
              <span className="font-medium">Subtitle:</span>{" "}
              {copy.edition.book.subtitle}
            </p>
          )}
          <p>
            <span className="font-medium">Format:</span>{" "}
            {copy?.edition?.format
              ? (formatLabels[copy.edition.format] ?? copy.edition.format)
              : "—"}
          </p>
          <p>
            <span className="font-medium">ISBN:</span>{" "}
            {copy?.edition?.isbn ?? "—"}
          </p>
          <p>
            <span className="font-medium">Publisher:</span>{" "}
            {copy?.edition?.publisher ?? "—"}
          </p>
          <p>
            <span className="font-medium">Published Year:</span>{" "}
            {copy?.edition?.published_year ?? "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
