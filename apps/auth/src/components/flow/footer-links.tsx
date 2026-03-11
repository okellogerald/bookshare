import NextLink from "next/link";
import { cn } from "@/lib/utils";
import type { FooterLink } from "./types";

interface FlowFooterLinksProps {
  links: FooterLink[];
}

export function FlowFooterLinks({ links }: FlowFooterLinksProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <div className="flow-footer-links">
      {links.map((link) => (
        <NextLink
          key={`${link.href}-${link.label}`}
          href={link.href}
          className={cn(
            "text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          )}
        >
          {link.label}
        </NextLink>
      ))}
    </div>
  );
}
