"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { useUpdateCopy } from "@/shared/queries/my-library";
import type { PgCopyDetail } from "@/shared/api";

const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass Market",
};

async function fetchCopy(id: string): Promise<PgCopyDetail> {
  const params = new URLSearchParams();
  params.set("id", `eq.${id}`);
  params.set("select", "*,edition:editions(*,book:books(*))");

  const response = await fetch(`/api/postgrest/copies?${params}`);
  if (!response.ok) throw new Error("Failed to fetch copy");
  const json = await response.json();
  if (!json.data?.[0]) throw new Error("Copy not found");
  return json.data[0];
}

export default function EditCopyPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [condition, setCondition] = useState("");
  const [shareType, setShareType] = useState("");
  const [notes, setNotes] = useState("");

  const { data: copy, isLoading } = useQuery({
    queryKey: ["copy", id],
    queryFn: () => fetchCopy(id),
  });
  const updateCopy = useUpdateCopy();

  useEffect(() => {
    if (!copy) return;
    setCondition(copy.condition ?? "good");
    setShareType(copy.share_type ?? "");
    setNotes(copy.notes ?? "");
  }, [copy]);

  async function handleSubmit() {
    await updateCopy.mutateAsync({
      id,
      body: {
        condition: condition || undefined,
        shareType: shareType || undefined,
        notes: notes.trim() || undefined,
      },
    });
    router.push("/my-library");
  }

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
            Edit condition, share type, and notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <div className="space-y-2">
              <Label>Share Type</Label>
              <Select value={shareType} onValueChange={setShareType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lend">Lend</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                  <SelectItem value="give_away">Give Away</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any additional notes about this copy..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/my-library">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              onClick={handleSubmit}
              disabled={updateCopy.isPending}
              className="gap-2"
            >
              {updateCopy.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
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
