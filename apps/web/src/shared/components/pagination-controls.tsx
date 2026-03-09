"use client";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
  className?: string;
}

function getVisiblePages(page: number, totalPages: number) {
  const windowSize = 5;
  const start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  const adjustedStart = Math.max(1, end - windowSize + 1);

  return Array.from(
    { length: end - adjustedStart + 1 },
    (_, index) => adjustedStart + index
  );
}

export function PaginationControls({
  page,
  pageSize,
  totalItems,
  onPageChange,
  className,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  const pages = getVisiblePages(page, totalPages);

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        Previous
      </Button>
      {pages.map((pageNumber) => (
        <Button
          key={pageNumber}
          type="button"
          size="sm"
          variant={pageNumber === page ? "default" : "outline"}
          onClick={() => onPageChange(pageNumber)}
        >
          {pageNumber}
        </Button>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        Next
      </Button>
    </div>
  );
}
