"use client";

import Link from "next/link";
import { Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  useMyCopies,
  useConfirmCopy,
  useUpdateCopyStatus,
  useDeleteCopy,
} from "@/shared/queries/my-library";

const statusLabels: Record<string, string> = {
  available: "Available",
  reserved: "Reserved",
  rented: "Rented",
  checked_out: "Checked Out",
  sold: "Sold",
  donated: "Donated",
  given_away: "Given Away",
  lost: "Lost",
  damaged: "Damaged",
};

const shareTypeLabels: Record<string, string> = {
  lend: "Lend",
  sell: "Sell",
  give_away: "Give Away",
};

export default function MyLibraryPage() {
  const { data: copies, isLoading } = useMyCopies();
  const confirmMutation = useConfirmCopy();
  const statusMutation = useUpdateCopyStatus();
  const deleteMutation = useDeleteCopy();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Library</h1>
          <p className="text-muted-foreground">
            Manage your book copies and listings
          </p>
        </div>
        <Link href="/my-library/add">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Copy
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : copies && copies.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Book</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Share Type</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {copies.map((copy) => (
              <TableRow key={copy.id}>
                <TableCell>
                  <div>
                    <Link
                      href={`/books/${copy.edition?.book?.id ?? ""}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {copy.edition?.book?.title ?? "Unknown"}
                    </Link>
                    {copy.edition?.isbn && (
                      <p className="text-xs text-muted-foreground">
                        ISBN: {copy.edition.isbn}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="capitalize">
                  {copy.edition?.format?.replace("_", " ") ?? "-"}
                </TableCell>
                <TableCell className="capitalize">
                  {copy.condition?.replace("_", " ") ?? "-"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      copy.status === "available" ? "default" : "secondary"
                    }
                  >
                    {statusLabels[copy.status] ?? copy.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {copy.share_type ? (
                    <Badge variant="outline">
                      {shareTypeLabels[copy.share_type] ?? copy.share_type}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => confirmMutation.mutate(copy.id)}
                      >
                        Confirm Available
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/my-library/${copy.id}/edit`}>
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {copy.status === "available" ? (
                        <DropdownMenuItem
                          onClick={() =>
                            statusMutation.mutate({
                              id: copy.id,
                              body: { status: "reserved" },
                            })
                          }
                        >
                          Mark Reserved
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() =>
                            statusMutation.mutate({
                              id: copy.id,
                              body: { status: "available" },
                            })
                          }
                        >
                          Mark Available
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(copy.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed">
          <p className="text-muted-foreground">No copies in your library yet</p>
          <Link href="/my-library/add">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add your first copy
            </Button>
          </Link>
        </div>
      )}

    </div>
  );
}
