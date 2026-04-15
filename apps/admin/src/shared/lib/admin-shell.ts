import {
  BookCopy,
  FolderKanban,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavChildItem {
  href: string;
  label: string;
}

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  children?: AdminNavChildItem[];
}

export interface AdminPageMeta {
  section: string;
  title: string;
}

export const adminNavItems: AdminNavItem[] = [
  {
    href: "/catalog",
    label: "Catalog",
    icon: BookCopy,
    description: "Search, inspect, and extend the live catalog.",
  },
  {
    href: "/batches",
    label: "Batches",
    icon: FolderKanban,
    description: "Validate importer ZIPs and review recent run history.",
    children: [
      { href: "/batches", label: "Validate" },
      { href: "/batches/runs", label: "Recent runs" },
    ],
  },
  {
    href: "/staff",
    label: "Staff",
    icon: ShieldCheck,
    description: "Grant platform access and keep internal roles clean.",
  },
];

const adminPageMetaByPath: Record<string, AdminPageMeta> = {
  "/catalog": {
    section: "Catalog",
    title: "Catalog workbench",
  },
  "/batches": {
    section: "Batches",
    title: "Validate imports",
  },
  "/batches/runs": {
    section: "Batches",
    title: "Recent runs",
  },
  "/staff": {
    section: "Staff",
    title: "Staff management",
  },
  "/profile": {
    section: "Account",
    title: "Profile",
  },
};

export function isActiveAdminPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getAdminPageMeta(pathname: string): AdminPageMeta {
  const exactMatch = adminPageMetaByPath[pathname];
  if (exactMatch) {
    return exactMatch;
  }

  const match = adminNavItems.find((item) => isActiveAdminPath(pathname, item.href));
  return adminPageMetaByPath[match?.href ?? "/catalog"];
}
