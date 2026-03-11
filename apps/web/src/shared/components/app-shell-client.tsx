"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Mail,
  BookMarked,
  BookOpen,
  Heart,
  Library,
  Search,
  Settings,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { UserProvider } from "@/shared/providers/user-provider";
import { useMyProfile } from "@/shared/queries/profile";
import { cn } from "@/shared/lib/utils";

interface User {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  emailVerified?: boolean;
}

const navItems = [
  { href: "/browse", label: "Browse", icon: Search },
  { href: "/wanted", label: "Wanted", icon: Heart },
  { href: "/community", label: "Community", icon: Users },
];

function getInitials(value: string): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  const compact = words[0] ?? value.trim();
  if (!compact) return "U";
  return compact.slice(0, 2).toUpperCase();
}

export function AppShellClient({
  children,
  user,
}: {
  children: React.ReactNode;
  user: User | null;
}) {
  const pathname = usePathname();
  const syncedProfile = useRef(false);
  const isEmailVerified = user?.emailVerified === true;
  const { data: myProfile } = useMyProfile({ enabled: !!user && isEmailVerified });
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    if (!user || !isEmailVerified || syncedProfile.current) return;
    syncedProfile.current = true;

    fetch("/api/nestjs/profiles/sync", { method: "POST" }).catch(() => {
      // Best-effort profile bootstrap for first-time users.
    });
  }, [isEmailVerified, user]);

  const profileFullName = [myProfile?.firstName, myProfile?.lastName]
    .filter((value): value is string => !!value && value.trim().length > 0)
    .join(" ")
    .trim();
  const displayName = profileFullName || user?.name?.trim() || "";
  const effectiveUsername = myProfile?.username ?? user?.username ?? "";
  const avatarLabel =
    displayName ||
    effectiveUsername ||
    user?.email?.trim() ||
    "U";
  const avatarUrl = myProfile?.avatarUrl?.trim() || null;
  const avatarInitials = getInitials(avatarLabel);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUrl]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-[var(--sidebar-width)] flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <BookOpen className="h-5 w-5" />
          <span className="text-lg font-semibold">BookShare</span>
        </div>
        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2 pt-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn("w-full justify-start gap-2")}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b bg-card px-4">
          {user ? (
            <div className="flex items-center gap-1">
              {isEmailVerified ? (
                <>
                  <Link href="/my-library">
                    <Button
                      variant={pathname.startsWith("/my-library") ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2"
                    >
                      <Library className="h-4 w-4" />
                      <span className="hidden md:inline">My Library</span>
                    </Button>
                  </Link>
                  <Link href="/my-wants">
                    <Button
                      variant={pathname.startsWith("/my-wants") ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2"
                    >
                      <BookMarked className="h-4 w-4" />
                      <span className="hidden md:inline">My Wants</span>
                    </Button>
                  </Link>
                </>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/auth/verification?returnTo=${encodeURIComponent(
                      pathname || "/browse"
                    )}`}
                  >
                    Verify Email
                  </Link>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={
                      pathname.startsWith("/profile") || pathname.startsWith("/settings")
                        ? "secondary"
                        : "ghost"
                    }
                    size="sm"
                    className="gap-2"
                  >
                    {avatarUrl && !avatarLoadFailed ? (
                      <img
                        src={avatarUrl}
                        alt="Profile avatar"
                        className="h-7 w-7 rounded-full border object-cover"
                        onError={() => setAvatarLoadFailed(true)}
                      />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold">
                        {avatarInitials}
                      </span>
                    )}
                    <span className="hidden sm:inline">
                      {effectiveUsername ? `@${effectiveUsername}` : "Account"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      View Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {!isEmailVerified ? (
                    <DropdownMenuItem asChild>
                      <Link
                        className="flex items-center gap-2"
                        href={`/auth/verification?returnTo=${encodeURIComponent(
                          pathname || "/browse"
                        )}`}
                      >
                        <Mail className="h-4 w-4" />
                        Verify Email
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem asChild>
                    <a href="/api/auth/logout" className="flex items-center gap-2">
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/auth/register">Create Account</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/api/auth/login?returnTo=/browse">Sign In</Link>
              </Button>
            </div>
          )}
        </header>
        <div className="flex-1 overflow-auto">
          <UserProvider user={user}>
            <div className="container max-w-6xl py-6">{children}</div>
          </UserProvider>
        </div>
      </main>
    </div>
  );
}
