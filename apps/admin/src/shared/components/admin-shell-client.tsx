"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LogOut, MoreVertical, ShieldCheck, User } from "lucide-react";
import { AdminFlowProvider } from "@/app/(admin)/_flows/admin-flow-provider";
import {
  adminNavItems,
  getAdminPageMeta,
  isActiveAdminPath,
} from "@/shared/lib/admin-shell";
import { useMyProfile, useSyncMyProfile } from "@/shared/queries/profile";
import { cn } from "@/shared/lib/utils";

interface UserData {
  id: string;
  email?: string;
  name?: string;
  emailVerified?: boolean;
}

function getInitials(firstName?: string | null, lastName?: string | null, fallback = "BS") {
  const first = firstName?.trim();
  const last = lastName?.trim();

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }

  if (first) {
    return first.slice(0, 2).toUpperCase();
  }

  return fallback;
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

export function AdminShellClient({
  children,
  user,
}: {
  children: React.ReactNode;
  user: UserData;
}) {
  const pathname = usePathname();
  const pageMeta = getAdminPageMeta(pathname);
  const isEmailVerified = user.emailVerified === true;
  const syncedProfile = useRef(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const { data: myProfile } = useMyProfile({ enabled: isEmailVerified });
  const syncMyProfile = useSyncMyProfile();
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

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
  const avatarUrl = myProfile?.avatarUrl?.trim() || null;
  const initials = getInitials(myProfile?.firstName, myProfile?.lastName, displayName.slice(0, 2));
  const email = myProfile?.email || user.email || "Staff user";

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUrl]);

  return (
    <AdminFlowProvider>
      <div className="flex min-h-screen bg-background">
        <aside className="hidden w-[var(--sidebar-width)] shrink-0 border-r bg-card lg:flex lg:flex-col">
          <div className="flex h-16 items-center border-b px-5">
            <Link href="/catalog" className="flex items-center gap-3 text-foreground">
              <BookOpen className="h-5 w-5" />
              <span className="text-sm font-semibold">BookShare</span>
            </Link>
          </div>

          <nav className="flex-1 px-3 py-4">
            {adminNavItems.map((item) => {
              const isActive = isActiveAdminPath(pathname, item.href);

              return (
                <div key={item.href} className="mb-1">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex items-center gap-3 lg:hidden">
                <BookOpen className="h-5 w-5" />
                <span className="text-sm font-semibold">BookShare</span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {pageMeta.section}
                </p>
                <p className="truncate text-sm font-semibold text-foreground">{pageMeta.title}</p>
              </div>
            </div>

            <div className="ml-4 flex items-center gap-2 sm:gap-3">
              <Link
                href="/team"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                  isActiveAdminPath(pathname, "/team")
                    ? "border-border bg-muted text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden md:inline">Team Management</span>
              </Link>

              <div ref={accountMenuRef} className="relative flex items-center gap-3">
                <span className="hidden max-w-[10rem] truncate text-sm font-medium text-foreground md:block">
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
                      <p className="text-sm font-medium text-foreground">{displayName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{email}</p>
                    </div>
                    <div className="h-px bg-border" />
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition hover:bg-accent"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
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
            </div>
          </header>

          <nav className="border-b bg-card px-4 py-2 lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {adminNavItems.map((item) => {
                const isActive = isActiveAdminPath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "min-w-max rounded-full px-3 py-1.5 text-sm transition",
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
    </AdminFlowProvider>
  );
}
