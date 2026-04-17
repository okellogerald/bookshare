"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleDashed,
  Heart,
  Inbox,
  Plus,
  Search,
} from "lucide-react";
import { useAdminFlow } from "@/flows/admin-flow-provider";
import { useCatalogSummaryCounts } from "@/domain/catalog/queries";
import { PageIntro } from "@/shared/components/page-intro";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";

function formatSummaryValue(value: number | null | undefined, loading: boolean) {
  if (typeof value === "number") {
    return new Intl.NumberFormat().format(value);
  }

  return loading ? "..." : "—";
}

export function CatalogPageContent() {
  const { openFlow } = useAdminFlow();
  const summaryQuery = useCatalogSummaryCounts();

  const summaryItems = [
    {
      label: "Titles",
      value: summaryQuery.data?.titles,
      detail: "Book records currently in the catalog.",
      href: "/catalog/titles",
    },
    {
      label: "Editions",
      value: summaryQuery.data?.editions,
      detail: "Cataloged release records ready for operations.",
      href: "/catalog/editions",
    },
    {
      label: "Copies",
      value: summaryQuery.data?.copies,
      detail: "Member-owned inventory rows in the system.",
      href: "/catalog/copies",
    },
    {
      label: "Wishes",
      value: summaryQuery.data?.wishes,
      detail: "Member wishes currently stored in the platform.",
      href: "/catalog/wishes",
    },
  ];

  const intakeCards = [
    {
      icon: Inbox,
      title: "Copy submissions",
      description:
        "Review member copy requests, match to catalog entries, and approve to create copies.",
      href: "/catalog/submissions" as string | null,
      reserved: false,
    },
    {
      icon: CircleDashed,
      title: "Want submissions",
      description:
        "Review member want requests, link to existing catalog books, and approve to create wishes.",
      href: "/catalog/want-submissions" as string | null,
      reserved: false,
    },
    {
      icon: Heart,
      title: "Requests",
      description:
        "Catalog-related requests move into this page instead of living as their own admin route.",
      href: null,
      reserved: true,
    },
  ];

  return (
    <section className="space-y-8">
      <PageIntro
        title="Catalog"
        description="Use the catalog page as the main operations surface: launch focused flows, monitor pending intake areas, and work through editions, copies, and wishes from one place."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-4"
              onClick={() => openFlow({ kind: "catalog-search" })}
            >
              <Search className="h-4 w-4" />
              Search Catalog
            </Button>
            <Button
              type="button"
              className="rounded-full px-4"
              onClick={() => openFlow({ kind: "add-edition" })}
            >
              <Plus className="h-4 w-4" />
              Add New Edition
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => (
          <Link key={item.label} href={item.href}>
            <Card className="group border-border/75 bg-card/[0.92] transition hover:border-primary/30 hover:shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition group-hover:text-primary" />
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                  {formatSummaryValue(item.value, summaryQuery.isLoading)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Intake queues</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Submission queues for member requests that require admin review before catalog data is committed.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {intakeCards.map((card) => {
            const inner = (
              <Card
                className={
                  card.href
                    ? "group border-border/75 bg-card/[0.92] transition hover:border-primary/30 hover:shadow-sm"
                    : "border-border/75 bg-card/[0.92]"
                }
              >
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-[1.1rem] border border-border/75 bg-background/80 p-3 text-primary">
                      <card.icon className="h-5 w-5" />
                    </div>
                    {card.reserved ? (
                      <Badge
                        variant="secondary"
                        className="border border-border/75 bg-background/75 text-muted-foreground"
                      >
                        Reserved
                      </Badge>
                    ) : (
                      <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition group-hover:text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {card.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );

            return card.href ? (
              <Link key={card.title} href={card.href}>
                {inner}
              </Link>
            ) : (
              <div key={card.title}>{inner}</div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
