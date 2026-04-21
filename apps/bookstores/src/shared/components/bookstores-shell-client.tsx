"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  IdCard,
  LogOut,
  MoreVertical,
  Store,
  Users,
} from "lucide-react";
import { BookstoreMembershipRole } from "@bookshare/shared";
import { useBookstoresMe } from "@/domain/bookstores/queries";
import { useMyProfile, useSyncMyProfile } from "@/shared/queries/profile";
import { Select } from "@/shared/components/ui/select";
import {
  getBookstorePrimaryRoute,
  setLastUsedBookstoreId,
} from "@/shared/lib/bookstores";
import { cn } from "@/shared/lib/utils";

interface UserData {
  id: string;
  email?: string;
  name?: string;
  emailVerified?: boolean;
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getCompactName({
  firstName,
  lastName,
  fallback,
}: {
  firstName?: string | null;
  lastName?: string | null;
  fallback: string;
}) {
  const first = firstName?.trim();
  const last = lastName?.trim();

  if (first && last) {
    return `${first} ${last[0].toUpperCase()}.`;
  }

  if (first) {
    return first;
  }

  const words = fallback.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]} ${words[1][0].toUpperCase()}.`;
  }

  return fallback;
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
  const isEmailVerified = user.emailVerified === true;
  const syncedProfile = useRef(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const { data: myProfile } = useMyProfile({ enabled: isEmailVerified });
  const syncMyProfile = useSyncMyProfile();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const currentBookstoreId = useMemo(() => {
    const match = pathname.match(/^\/orgs\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const currentMembership =
    memberships.find((entry) => entry.organizationId === currentBookstoreId) ?? null;
  const currentOrganization = currentMembership?.organization ?? null;
  const canManageMembers =
    currentMembership?.role === BookstoreMembershipRole.OWNER;

  useEffect(() => {
    if (currentOrganization) {
      setLastUsedBookstoreId(currentOrganization.id);
    }
  }, [currentOrganization]);

  useEffect(() => {
    if (!isEmailVerified || syncedProfile.current) {
      return;
    }

    syncedProfile.current = true;
    syncMyProfile.mutate();
  }, [isEmailVerified, syncMyProfile]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const fallbackName = user.name?.trim() || user.email?.trim() || user.id;
  const displayName = getCompactName({
    firstName: myProfile?.firstName,
    lastName: myProfile?.lastName,
    fallback: fallbackName,
  });
  const email = myProfile?.email || user.email || "Signed in";

  const navItems = currentOrganization
    ? [
        {
          href: `/orgs/${currentOrganization.id}/wants`,
          label: "Wants",
          icon: Store,
        },
      ]
    : [];

  const membersHref = currentOrganization
    ? `/orgs/${currentOrganization.id}/members`
    : null;
  const profileHref = currentOrganization
    ? `/orgs/${currentOrganization.id}/profile`
    : null;

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

        {memberships.length > 1 ? (
          <div className="space-y-2 px-4 py-5">
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
        ) : null}

        <nav className="flex-1 px-3 py-4">
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

        {currentOrganization ? (
          <div className="border-t px-4 py-4">
            <p className="font-display text-sm font-semibold tracking-[-0.03em]">
              {currentOrganization.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canManageMembers ? "Owner" : "Member"}
            </p>
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-end gap-2 border-b bg-card px-4 sm:gap-3 sm:px-6">
          {membersHref ? (
              canManageMembers ? (
                <Link
                  href={membersHref}
                  className={cn(
                    "font-display inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm tracking-[-0.025em] transition",
                    isActivePath(pathname, membersHref)
                      ? "border-border bg-muted text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden md:inline">Members</span>
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title="Only owners can manage members"
                  className="font-display inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-transparent px-3 py-2 text-sm tracking-[-0.025em] text-muted-foreground/60"
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden md:inline">Members</span>
                </span>
              )
            ) : null}

            {profileHref ? (
              <Link
                href={profileHref}
                className={cn(
                  "font-display inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm tracking-[-0.025em] transition",
                  isActivePath(pathname, profileHref)
                    ? "border-border bg-muted text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <IdCard className="h-4 w-4" />
                <span className="hidden md:inline">Profile</span>
              </Link>
            ) : null}

            <div ref={accountMenuRef} className="relative flex items-center gap-3">
              <span className="font-display hidden max-w-[10rem] truncate text-sm font-medium tracking-[-0.025em] text-foreground md:block">
                {displayName}
              </span>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((value) => !value)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {accountMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 overflow-hidden rounded-xl border bg-card shadow-md">
                  <div className="px-3 py-2.5">
                    <p className="font-display text-sm font-medium tracking-[-0.025em] text-foreground">
                      {displayName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {email}
                    </p>
                  </div>
                  <div className="h-px bg-border" />
                  <a
                    href="/api/auth/logout"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition hover:bg-accent"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </a>
                </div>
              ) : null}
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
