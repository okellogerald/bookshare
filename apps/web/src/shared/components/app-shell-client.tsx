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
  Users,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
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

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-[var(--sidebar-width)] flex-col border-r bg-card">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 px-4">
          <BookOpen className="h-5 w-5" />
          <span className="text-lg font-semibold">BookShare</span>
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
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

        {/* User section */}
        <div className="border-t p-4">
          {user && (
            <div className="space-y-2">
              <p className="truncate text-sm font-medium">
                {user.name || user.email || "User"}
              </p>
              <Link href="/api/auth/logout">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <UserProvider user={user}>
          <div className="container max-w-6xl py-6">{children}</div>
        </UserProvider>
      </main>
    </div>
  );
}
