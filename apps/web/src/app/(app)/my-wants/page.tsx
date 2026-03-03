"use client";

import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Badge } from "@/shared/components/ui/badge";
import { MoreHorizontal, Plus } from "lucide-react";
import { useMyWants, useConfirmWant, useDeleteWant } from "@/shared/queries/my-wants";

function isStale(lastConfirmedAt: string | null): boolean {
  if (!lastConfirmedAt) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastConfirmedAt).getTime() > thirtyDaysMs;
}

export default function MyWantsPage() {
  const { data: wants, isLoading } = useMyWants();
  const confirmWant = useConfirmWant();
  const deleteWant = useDeleteWant();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Wants</h1>
          <p className="text-muted-foreground">
            Books you&apos;re looking for
          </p>
        </div>
        <Link href="/my-wants/add">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Want
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !wants?.length ? (
        <p className="text-muted-foreground">
          You haven&apos;t posted any wants yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Book</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {wants.map((want) => {
              const stale = isStale(want.last_confirmed_at);
              return (
                <TableRow key={want.id}>
                  <TableCell className="font-medium">
                    {want.book_id}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {want.notes || "—"}
                  </TableCell>
                  <TableCell>
                    {stale ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        Stale
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(want.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => confirmWant.mutate(want.id)}
                        >
                          Confirm Still Wanted
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteWant.mutate(want.id)}
                        >
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
