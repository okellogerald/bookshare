"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { PgWantWithBook } from "@/shared/api";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { useDeleteWant, useUpdateWant } from "@/shared/queries/my-wants";

async function fetchWant(id: string): Promise<PgWantWithBook> {
  const params = new URLSearchParams();
  params.set("id", `eq.${id}`);
  params.set("select", "*,book:books(*)");

  const response = await fetch(`/api/postgrest/wants?${params}`);
  if (!response.ok) throw new Error("Failed to fetch want");
  const json = await response.json();
  if (!json.data?.[0]) throw new Error("Want not found");
  return json.data[0] as PgWantWithBook;
}

export default function EditWantPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: want, isLoading, isError, error } = useQuery({
    queryKey: ["want", id],
    queryFn: () => fetchWant(id),
  });
  const updateWant = useUpdateWant();
  const deleteWant = useDeleteWant();

  useEffect(() => {
    if (!want) return;
    setNotes(want.notes ?? "");
  }, [want]);

  async function handleSave() {
    setErrorMessage(null);
    try {
      await updateWant.mutateAsync({
        id,
        body: {
          notes: notes.trim() || undefined,
        },
      });
      router.push("/my-wants");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update want."
      );
    }
  }

  async function handleDelete() {
    setErrorMessage(null);
    try {
      await deleteWant.mutateAsync(id);
      router.push("/my-wants");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete want."
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !want) {
    return (
      <div className="space-y-4">
        <Link href="/my-wants">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to My Wants
          </Button>
        </Link>
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load want."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/my-wants">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Want</h1>
          <p className="text-muted-foreground">
            {want.book?.title ?? "Wanted book"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Want Notes</CardTitle>
          <CardDescription>
            Update your note or remove this want from your list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything to say to lenders or sellers"
              rows={6}
            />
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteWant.isPending || updateWant.isPending}
            >
              {deleteWant.isPending ? "Deleting..." : "Delete Want"}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/my-wants")}
              disabled={deleteWant.isPending || updateWant.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateWant.isPending || deleteWant.isPending}
              className="gap-2"
            >
              {updateWant.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Notes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
