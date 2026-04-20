"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  LogOut,
  Settings,
  Store,
  Users,
} from "lucide-react";
import { BookstoreMembershipRole } from "@bookshare/shared";
import { useBookstoresMe } from "@/domain/bookstores/queries";
import { Badge } from "@/shared/components/ui/badge";
import { Select } from "@/shared/components/ui/select";
import {
  getBookstorePrimaryRoute,
  setLastUsedBookstoreId,
} from "@/shared/lib/bookstores";
import { cn } from "@/shared/lib/utils";
import { BookstoreStatusBadge } from "./bookstore-status";

interface UserData {
  id: string;
  email?: string;
  name?: string;
  emailVerified?: boolean;
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BookstoresShellClient({
  children,
  user,
}: {
  children: React.ReactNode;
  user: UserData;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useBookstoresMe();
  const memberships = data?.memberships ?? [];

  const currentBookstoreId = useMemo(() => {
    const match = pathname.match(/^\/orgs\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const currentMembership =
    memberships.find((entry) => entry.organizationId === currentBookstoreId) ?? null;
  const currentOrganization = currentMembership?.organization ?? null;

  useEffect(() => {
    if (currentOrganization) {
      setLastUsedBookstoreId(currentOrganization.id);
    }
  }, [currentOrganization]);

  const navItems = currentOrganization
    ? [
        {
          href: `/orgs/${currentOrganization.id}/wants`,
          label: "Wants",
          icon: Store,
          visible: true,
        },
        {
          href: `/orgs/${currentOrganization.id}/members`,
          label: "Members",
          icon: Users,
          visible: currentMembership?.role === BookstoreMembershipRole.OWNER,
        },
        {
          href: `/orgs/${currentOrganization.id}/settings`,
          label: "Settings",
          icon: Settings,
          visible: true,
        },
      ].filter((item) => item.visible)
    : [];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-[var(--sidebar-width)] shrink-0 border-r bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b px-5">
          <Link href="/" className="flex items-center gap-3 text-foreground">
            <Building2 className="h-5 w-5" />
            <span className="font-display text-[0.95rem] font-semibold tracking-[-0.04em]">
              Bookstores
            </span>
          </Link>
        </div>

        <div className="space-y-4 px-4 py-5">
          {memberships.length > 1 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Active bookstore
              </p>
              <Select
                value={currentOrganization?.id ?? ""}
                onChange={(event) => {
                  const next = memberships.find(
                    (entry) => entry.organization.id === event.target.value
                  );
                  if (!next) return;
                  setLastUsedBookstoreId(next.organization.id);
                  router.push(getBookstorePrimaryRoute(next.organization));
                }}
              >
                {memberships.map((membership) => (
                  <option
                    key={membership.organization.id}
                    value={membership.organization.id}
                  >
                    {membership.organization.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : currentOrganization ? (
            <div className="space-y-2 rounded-[1.4rem] border border-border/70 bg-background/70 p-4">
              <p className="font-display text-base font-semibold tracking-[-0.03em]">
                {currentOrganization.name}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <BookstoreStatusBadge status={currentOrganization.status} />
                <Badge variant="outline">
                  {currentMembership?.role === BookstoreMembershipRole.OWNER
                    ? "Owner"
                    : "Member"}
                </Badge>
              </div>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 px-3 pb-4">
          {navItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "font-display mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm tracking-[-0.025em] transition",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              BookShare
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="font-display truncate text-base font-semibold tracking-[-0.03em]">
                {currentOrganization?.name ?? "Bookstores"}
              </p>
              {currentOrganization ? (
                <BookstoreStatusBadge status={currentOrganization.status} />
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">
                {user.name?.trim() || user.email?.trim() || "BookShare account"}
              </p>
              <p className="text-xs text-muted-foreground">
                {user.email || "Signed in"}
              </p>
            </div>
            <a
              href="/api/auth/logout"
              className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm text-foreground transition hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </a>
          </div>
        </header>

        <nav className="border-b bg-card px-4 py-2 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const isActive = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "font-display min-w-max rounded-full px-3 py-1.5 text-sm tracking-[-0.025em] transition",
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 overflow-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
