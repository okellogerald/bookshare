"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown, LogOut, User } from "lucide-react";
import { adminNavItems, isActiveAdminPath } from "@/shared/lib/admin-shell";
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
    return `${first} ${last[0].toUpperCase()}`;
  }

  if (first) {
    return first;
  }

  const words = fallback.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]} ${words[1][0].toUpperCase()}`;
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
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-[var(--sidebar-width)] shrink-0 border-r bg-card lg:flex lg:flex-col">
        <div className="flex h-14 items-center border-b px-5">
          <Link href="/catalog" className="flex items-center gap-3 text-foreground">
            <BookOpen className="h-5 w-5" />
            <span className="text-sm font-semibold">BookShare Admin</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4">
          {adminNavItems.map((item) => {
            const isActive = isActiveAdminPath(pathname, item.href);
            const showChildren = item.children?.some((child) =>
              isActiveAdminPath(pathname, child.href)
            );

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

                {item.children && showChildren ? (
                  <div className="ml-8 mt-1 border-l pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "block rounded-md px-2 py-2 text-sm transition",
                          pathname === child.href
                            ? "font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 sm:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <BookOpen className="h-5 w-5" />
            <span className="text-sm font-semibold">BookShare Admin</span>
          </div>

          <div ref={accountMenuRef} className="relative ml-auto">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((value) => !value)}
              className="flex items-center gap-3 rounded-full border bg-background px-2 py-1.5 text-left transition hover:bg-muted/60"
            >
              {avatarUrl && !avatarLoadFailed ? (
                <img
                  src={avatarUrl}
                  alt="Profile avatar"
                  className="h-8 w-8 rounded-full object-cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-card text-xs font-semibold text-foreground">
                  {initials}
                </span>
              )}
              <span className="max-w-[10rem] truncate text-sm font-medium text-foreground">
                {displayName}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {accountMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 overflow-hidden rounded-xl border bg-card shadow-md">
                <div className="px-3 py-3">
                  <p className="text-sm font-medium text-foreground">{displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{email}</p>
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
        </header>

        <nav className="border-b bg-card px-4 py-2 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {adminNavItems.flatMap((item) =>
              item.children && isActiveAdminPath(pathname, item.href)
                ? item.children.map((child) => ({ ...child, exact: true }))
                : [{ href: item.href, label: item.label, exact: false }]
            ).map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : isActiveAdminPath(pathname, item.href);

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
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
