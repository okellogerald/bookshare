"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useBookstore } from "@/domain/bookstores/queries";
import { getBookstorePrimaryRoute } from "@/shared/lib/bookstores";

export default function BookstoreOrgIndexPage() {
  const params = useParams<{ bookstoreId: string }>();
  const router = useRouter();
  const bookstoreId = params.bookstoreId;
  const { data, isLoading, error } = useBookstore(bookstoreId);

  useEffect(() => {
    if (data) {
      router.replace(getBookstorePrimaryRoute(data));
    }
  }, [data, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading bookstore…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      Redirecting…
    </div>
  );
}
