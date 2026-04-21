"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Loader2, Mail } from "lucide-react";
import type { BookstoreBootstrapMembership } from "@bookshare/shared";
import { useBookstoresMe } from "@/domain/bookstores/queries";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  getBookstorePrimaryRoute,
  getLastUsedBookstoreId,
  setLastUsedBookstoreId,
} from "@/shared/lib/bookstores";
import { formatUiDateTime } from "@/shared/lib/date";
import { BookstoreStatusBadge } from "@/shared/components/bookstore-status";

function MembershipCard({
  membership,
}: {
  membership: BookstoreBootstrapMembership;
}) {
  const primaryRoute = getBookstorePrimaryRoute(membership.organization);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{membership.organization.name}</CardTitle>
          <BookstoreStatusBadge status={membership.organization.status} />
        </div>
        <CardDescription>
          Joined {formatUiDateTime(membership.joinedAt)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full justify-between">
          <Link
            href={primaryRoute}
            onClick={() => setLastUsedBookstoreId(membership.organization.id)}
          >
            Open workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function BookstoresHomeClient() {
  const router = useRouter();
  const { data, isLoading, error } = useBookstoresMe();
  const memberships = data?.memberships ?? [];

  const lastUsedMembership = useMemo(() => {
    const lastUsedId = getLastUsedBookstoreId();
    if (!lastUsedId) return null;
    return memberships.find((entry) => entry.organizationId === lastUsedId) ?? null;
  }, [memberships]);

  useEffect(() => {
    if (!data) return;

    if (memberships.length === 1) {
      setLastUsedBookstoreId(memberships[0].organizationId);
      router.replace(getBookstorePrimaryRoute(memberships[0].organization));
      return;
    }

    if (memberships.length > 1 && lastUsedMembership) {
      setLastUsedBookstoreId(lastUsedMembership.organizationId);
      router.replace(getBookstorePrimaryRoute(lastUsedMembership.organization));
    }
  }, [data, lastUsedMembership, memberships, router]);

  const errorMessage = (error as Error | null)?.message ?? null;

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your bookstore access…
        </div>
      </main>
    );
  }

  if (memberships.length === 1 || (memberships.length > 1 && lastUsedMembership)) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Opening your bookstore workspace…
        </div>
      </main>
    );
  }

  if (memberships.length > 1) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="space-y-2">
            <Badge variant="secondary">Bookstores</Badge>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.04em]">
              Choose a bookstore workspace
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              You belong to multiple bookstores. Pick the one you want to work in now.
            </p>
          </div>

          {errorMessage ? (
            <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {memberships.map((membership) => (
              <MembershipCard
                key={membership.organizationId}
                membership={membership}
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <CardTitle>No bookstore access yet</CardTitle>
          <CardDescription>
            A platform admin or bookstore owner must invite your verified email.
            Matching invites are added automatically when you sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? (
            <div className="rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-[1.2rem] border border-border/75 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Ask the admin to use the same email you use for BookShare. You do
              not need to accept an invite from this page.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
