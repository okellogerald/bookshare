import {
  BookCopy,
  FolderKanban,
  Inbox,
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
    description: "Review current titles and extend the catalog with new editions.",
  },
  {
    href: "/batches",
    label: "Imports",
    icon: FolderKanban,
    description: "Run batch imports, validate issues, and review recent import history.",
  },
  {
    href: "/requests",
    label: "Requests",
    icon: Inbox,
    description: "Track member-submitted requests that need staff follow-up.",
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
  "/requests": {
    section: "Requests",
    title: "Requests",
  },
  "/batches": {
    section: "Imports",
    title: "Imports",
  },
  "/batches/runs": {
    section: "Imports",
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
