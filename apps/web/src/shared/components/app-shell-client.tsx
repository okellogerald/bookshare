"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  BookOpen,
  Heart,
  Library,
  LogOut,
  Search,
  UserCircle2,
  Users,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { UserProvider } from "@/shared/providers/user-provider";
import { cn } from "@/shared/lib/utils";

interface User {
  id: string;
  email?: string;
  name?: string;
  username?: string;
}

const navItems = [
  { href: "/browse", label: "Browse", icon: Search },
  { href: "/wanted", label: "Wanted", icon: Heart },
  { href: "/community", label: "Community", icon: Users },
  { href: "/profile", label: "Profile", icon: UserCircle2 },
  { href: "/my-library", label: "My Library", icon: Library },
  { href: "/my-wants", label: "My Wants", icon: BookMarked },
];

export function AppShellClient({
  children,
  user,
}: {
  children: React.ReactNode;
  user: User | null;
}) {
  const pathname = usePathname();
  const syncedProfile = useRef(false);

  useEffect(() => {
    if (!user || syncedProfile.current) return;
    syncedProfile.current = true;

    fetch("/api/nestjs/profiles/sync", { method: "POST" }).catch(() => {
      // Best-effort profile bootstrap for first-time users.
    });
  }, [user]);

  const avatarInitial =
    user?.name?.trim()?.charAt(0).toUpperCase() ||
    user?.username?.trim()?.charAt(0).toUpperCase() ||
    user?.email?.trim()?.charAt(0).toUpperCase() ||
    "U";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-[var(--sidebar-width)] flex-col border-r bg-card">
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
        <header className="flex h-14 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <span className="text-lg font-semibold">BookShare</span>
          </div>
          {user && (
            <div className="flex items-center gap-1">
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
              <Link href="/profile">
                <Button
                  variant={pathname.startsWith("/profile") ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold">
                    {avatarInitial}
                  </span>
                  <span className="hidden sm:inline">
                    {user.username ? `@${user.username}` : "Profile"}
                  </span>
                </Button>
              </Link>
              <a href="/api/auth/logout">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </a>
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
