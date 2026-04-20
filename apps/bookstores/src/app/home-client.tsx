"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Store,
} from "lucide-react";
import type {
  BookstoreBootstrapMembership,
  BookstorePendingInvite,
} from "@bookshare/shared";
import {
  useAcceptBookstoreInvite,
  useBookstoresMe,
  useCreateBookstore,
} from "@/domain/bookstores/queries";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  getBookstorePrimaryRoute,
  getLastUsedBookstoreId,
  setLastUsedBookstoreId,
} from "@/shared/lib/bookstores";
import { formatUiDateTime } from "@/shared/lib/date";
import { BookstoreStatusBadge } from "@/shared/components/bookstore-status";

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
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          {membership.organization.websiteUrl ? (
            <p>{membership.organization.websiteUrl}</p>
          ) : null}
          {membership.organization.email ? <p>{membership.organization.email}</p> : null}
          {membership.organization.phone ? <p>{membership.organization.phone}</p> : null}
        </div>
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

function PendingInviteCard({
  invite,
  onAccept,
  isPending,
}: {
  invite: BookstorePendingInvite;
  onAccept: (invite: BookstorePendingInvite) => Promise<void>;
  isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{invite.organization.name}</CardTitle>
          <BookstoreStatusBadge status={invite.organization.status} />
        </div>
        <CardDescription>
          Invitation sent to {invite.invitedEmail}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Created {formatUiDateTime(invite.createdAt)}
        </p>
        <Button
          type="button"
          onClick={() => onAccept(invite)}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Accept invite
        </Button>
      </CardContent>
    </Card>
  );
}

export function BookstoresHomeClient() {
  const router = useRouter();
  const { data, isLoading, error } = useBookstoresMe();
  const createBookstore = useCreateBookstore();
  const acceptInvite = useAcceptBookstoreInvite();
  const [form, setForm] = useState(emptyForm);

  const memberships = data?.memberships ?? [];
  const pendingInvites = data?.pendingInvites ?? [];

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

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await createBookstore.mutateAsync(form);
    setLastUsedBookstoreId(created.id);
    router.push(getBookstorePrimaryRoute(created));
  }

  async function handleAcceptInvite(invite: BookstorePendingInvite) {
    await acceptInvite.mutateAsync(invite.id);
    setLastUsedBookstoreId(invite.organization.id);
    router.push(getBookstorePrimaryRoute(invite.organization));
  }

  const errorMessage =
    (createBookstore.error as Error | null)?.message ||
    (acceptInvite.error as Error | null)?.message ||
    (error as Error | null)?.message ||
    null;

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

  if (memberships.length > 0 && !lastUsedMembership && memberships.length > 1) {
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

          {pendingInvites.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">
                  Pending invites
                </h2>
                <p className="text-sm text-muted-foreground">
                  You can still accept invites into additional bookstores.
                </p>
              </div>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <PendingInviteCard
                    key={invite.id}
                    invite={invite}
                    onAccept={handleAcceptInvite}
                    isPending={acceptInvite.isPending}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">
          <div className="space-y-3">
            <Badge variant="secondary">Bookstores</Badge>
            <h1 className="font-display text-4xl font-semibold tracking-[-0.05em]">
              Create or join a bookstore organization
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Bookstores can browse active wants, send one proposal per want, and keep a
              public contact card that readers use to reach them.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="flex items-start gap-3 p-6">
                <Store className="mt-0.5 h-5 w-5 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">Manual approval</p>
                  <p className="text-sm text-muted-foreground">
                    New bookstores start pending until a platform admin approves them.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start gap-3 p-6">
                <Mail className="mt-0.5 h-5 w-5 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">Invite-based access</p>
                  <p className="text-sm text-muted-foreground">
                    Owners manage members directly after approval.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {pendingInvites.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">
                  Pending invites
                </h2>
                <p className="text-sm text-muted-foreground">
                  Accept one of these invites to enter an approved bookstore workspace.
                </p>
              </div>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <PendingInviteCard
                    key={invite.id}
                    invite={invite}
                    onAccept={handleAcceptInvite}
                    isPending={acceptInvite.isPending}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Create bookstore</CardTitle>
              </div>
              <CardDescription>
                You become the first owner. Contact details stay public for readers to use.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
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
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Public email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, email: event.target.value }))
                      }
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
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactNote">Contact note</Label>
                  <Textarea
                    id="contactNote"
                    rows={4}
                    value={form.contactNote}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        contactNote: event.target.value,
                      }))
                    }
                    placeholder="Opening hours, preferred contact method, or any extra instructions."
                  />
                </div>

                {errorMessage ? (
                  <div className="rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="w-full justify-between"
                  disabled={createBookstore.isPending}
                >
                  {createBookstore.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating bookstore
                    </>
                  ) : (
                    <>
                      Create bookstore
                      <CheckCircle2 className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
