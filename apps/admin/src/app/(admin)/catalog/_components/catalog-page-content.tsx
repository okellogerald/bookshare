"use client";

import { useMemo, useState } from "react";
import {
  CircleDashed,
  Heart,
  Inbox,
  Plus,
  Search,
} from "lucide-react";
import { useAdminFlow } from "@/flows/admin-flow-provider";
import {
  useCatalogCopies,
  useCatalogEditions,
  useCatalogSummaryCounts,
  useCatalogWishes,
} from "@/domain/catalog/queries";
import { useMemberDirectory } from "@/domain/members/queries";
import { PageIntro } from "@/shared/components/page-intro";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

type EditionsSort = "latest_desc" | "title_asc" | "year_desc";
type CopiesSort = "latest_desc" | "title_asc" | "status_asc";
type WishesSort = "latest_desc" | "title_asc" | "status_asc";

function formatSummaryValue(value: number | null | undefined, loading: boolean) {
  if (typeof value === "number") {
    return new Intl.NumberFormat().format(value);
  }

  return loading ? "..." : "—";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function TablePanel({
  title,
  description,
  totalLabel,
  searchPlaceholder,
  query,
  onQueryChange,
  sortValue,
  onSortChange,
  sortOptions,
  filterValue,
  onFilterChange,
  filterOptions,
  children,
}: {
  title: string;
  description: string;
  totalLabel: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  sortValue: string;
  onSortChange: (value: string) => void;
  sortOptions: Array<{ value: string; label: string }>;
  filterValue: string;
  onFilterChange: (value: string) => void;
  filterOptions: Array<{ value: string; label: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/75 bg-card/[0.92]">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Badge
            variant="secondary"
            className="border border-border/75 bg-background px-3 py-1 text-muted-foreground"
          >
            {totalLabel}
          </Badge>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
          />
          <Select value={sortValue} onChange={(event) => onSortChange(event.target.value)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select value={filterValue} onChange={(event) => onFilterChange(event.target.value)}>
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {children}
      </CardContent>
    </Card>
  );
}

export function CatalogPageContent() {
  const { openFlow } = useAdminFlow();
  const summaryQuery = useCatalogSummaryCounts();
  const editionsQuery = useCatalogEditions(60);
  const copiesQuery = useCatalogCopies(60);
  const wishesQuery = useCatalogWishes(60);
  const membersQuery = useMemberDirectory();
  const [editionQuery, setEditionQuery] = useState("");
  const [editionSort, setEditionSort] = useState<EditionsSort>("latest_desc");
  const [editionFormatFilter, setEditionFormatFilter] = useState("all");
  const [copyQuery, setCopyQuery] = useState("");
  const [copySort, setCopySort] = useState<CopiesSort>("latest_desc");
  const [copyStatusFilter, setCopyStatusFilter] = useState("all");
  const [wishQuery, setWishQuery] = useState("");
  const [wishSort, setWishSort] = useState<WishesSort>("latest_desc");
  const [wishStatusFilter, setWishStatusFilter] = useState("all");

  const memberNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of membersQuery.data ?? []) {
      map.set(member.user_id, member.displayName);
    }
    return map;
  }, [membersQuery.data]);

  const editions = editionsQuery.data ?? [];
  const copies = copiesQuery.data ?? [];
  const wishes = wishesQuery.data ?? [];

  const availableEditionFormats = useMemo(
    () =>
      Array.from(new Set(editions.map((edition) => edition.format).filter(Boolean))).sort(),
    [editions]
  );
  const availableCopyStatuses = useMemo(
    () => Array.from(new Set(copies.map((copy) => copy.status).filter(Boolean))).sort(),
    [copies]
  );
  const availableWishStatuses = useMemo(
    () => Array.from(new Set(wishes.map((wish) => wish.status).filter(Boolean))).sort(),
    [wishes]
  );

  const filteredEditions = useMemo(() => {
    const normalizedQuery = editionQuery.trim().toLowerCase();

    return [...editions]
      .filter((edition) => {
        if (editionFormatFilter !== "all" && edition.format !== editionFormatFilter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystacks = [
          edition.book?.title?.toLowerCase() ?? "",
          edition.book?.subtitle?.toLowerCase() ?? "",
          edition.isbn?.toLowerCase() ?? "",
          edition.publisher?.toLowerCase() ?? "",
        ];

        return haystacks.some((value) => value.includes(normalizedQuery));
      })
      .sort((left, right) => {
        switch (editionSort) {
          case "title_asc":
            return (left.book?.title ?? "").localeCompare(right.book?.title ?? "", undefined, {
              sensitivity: "base",
            });
          case "year_desc":
            return (
              (right.published_year ?? 0) - (left.published_year ?? 0) ||
              right.created_at.localeCompare(left.created_at)
            );
          case "latest_desc":
          default:
            return right.created_at.localeCompare(left.created_at);
        }
      });
  }, [editionFormatFilter, editionQuery, editionSort, editions]);

  const filteredCopies = useMemo(() => {
    const normalizedQuery = copyQuery.trim().toLowerCase();

    return [...copies]
      .filter((copy) => {
        if (copyStatusFilter !== "all" && copy.status !== copyStatusFilter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystacks = [
          copy.edition?.book?.title?.toLowerCase() ?? "",
          copy.edition?.isbn?.toLowerCase() ?? "",
          copy.user_id.toLowerCase(),
          (memberNamesById.get(copy.user_id) ?? "").toLowerCase(),
        ];

        return haystacks.some((value) => value.includes(normalizedQuery));
      })
      .sort((left, right) => {
        switch (copySort) {
          case "title_asc":
            return (left.edition?.book?.title ?? "").localeCompare(
              right.edition?.book?.title ?? "",
              undefined,
              { sensitivity: "base" }
            );
          case "status_asc":
            return left.status.localeCompare(right.status, undefined, { sensitivity: "base" });
          case "latest_desc":
          default:
            return right.created_at.localeCompare(left.created_at);
        }
      });
  }, [copies, copyQuery, copySort, copyStatusFilter, memberNamesById]);

  const filteredWishes = useMemo(() => {
    const normalizedQuery = wishQuery.trim().toLowerCase();

    return [...wishes]
      .filter((wish) => {
        if (wishStatusFilter !== "all" && wish.status !== wishStatusFilter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystacks = [
          wish.book?.title?.toLowerCase() ?? "",
          wish.edition?.isbn?.toLowerCase() ?? "",
          wish.user_id.toLowerCase(),
          (memberNamesById.get(wish.user_id) ?? "").toLowerCase(),
        ];

        return haystacks.some((value) => value.includes(normalizedQuery));
      })
      .sort((left, right) => {
        switch (wishSort) {
          case "title_asc":
            return (left.book?.title ?? "").localeCompare(right.book?.title ?? "", undefined, {
              sensitivity: "base",
            });
          case "status_asc":
            return left.status.localeCompare(right.status, undefined, { sensitivity: "base" });
          case "latest_desc":
          default:
            return right.created_at.localeCompare(left.created_at);
        }
      });
  }, [memberNamesById, wishQuery, wishSort, wishStatusFilter, wishes]);

  const summaryItems = [
    {
      label: "Titles",
      value: summaryQuery.data?.titles,
      detail: "Book records currently in the catalog.",
    },
    {
      label: "Editions",
      value: summaryQuery.data?.editions,
      detail: "Cataloged release records ready for operations.",
    },
    {
      label: "Copies",
      value: summaryQuery.data?.copies,
      detail: "Member-owned inventory rows in the system.",
    },
    {
      label: "Wishes",
      value: summaryQuery.data?.wishes,
      detail: "Member wishes currently stored in the platform.",
    },
  ];

  const intakeCards = [
    {
      icon: Inbox,
      title: "Copy submissions",
      description:
        "Reserved for the DB-backed intake queue that will replace email-only copy submissions.",
    },
    {
      icon: CircleDashed,
      title: "Want submissions",
      description:
        "Reserved for missing-title and want-submission review once those requests are persisted in the database.",
    },
    {
      icon: Heart,
      title: "Requests",
      description:
        "Catalog-related requests move into this page instead of living as their own admin route.",
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
          <Card key={item.label} className="border-border/75 bg-card/[0.92]">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                {formatSummaryValue(item.value, summaryQuery.isLoading)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reserved intake queues</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These queues are intentionally reserved for the later DB-backed submissions service.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {intakeCards.map((card) => (
            <Card key={card.title} className="border-border/75 bg-card/[0.92]">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-[1.1rem] border border-border/75 bg-background/80 p-3 text-primary">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <Badge
                    variant="secondary"
                    className="border border-border/75 bg-background/75 text-muted-foreground"
                  >
                    Reserved
                  </Badge>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="space-y-6">
        <TablePanel
          title="Available editions"
          description="Recent catalog editions with local filtering, sorting, and search."
          totalLabel={`${filteredEditions.length} shown`}
          searchPlaceholder="Search editions by title, subtitle, ISBN, or publisher"
          query={editionQuery}
          onQueryChange={setEditionQuery}
          sortValue={editionSort}
          onSortChange={(value) => setEditionSort(value as EditionsSort)}
          sortOptions={[
            { value: "latest_desc", label: "Sort: Latest" },
            { value: "title_asc", label: "Sort: Title" },
            { value: "year_desc", label: "Sort: Published Year" },
          ]}
          filterValue={editionFormatFilter}
          onFilterChange={setEditionFormatFilter}
          filterOptions={[
            { value: "all", label: "Format: All" },
            ...availableEditionFormats.map((value) => ({
              value,
              label: `Format: ${value.replace(/_/g, " ")}`,
            })),
          ]}
        >
          {editionsQuery.isError ? (
            <p className="text-sm text-red-700">
              {editionsQuery.error instanceof Error
                ? editionsQuery.error.message
                : "Failed to load editions."}
            </p>
          ) : editionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading editions...</p>
          ) : filteredEditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No editions match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>ISBN</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Year</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEditions.map((edition) => (
                  <TableRow key={edition.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{edition.book?.title ?? "Untitled"}</p>
                      {edition.book?.subtitle ? (
                        <p className="mt-1 text-xs text-muted-foreground">{edition.book.subtitle}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>{edition.isbn || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{edition.format.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>{edition.publisher || "—"}</TableCell>
                    <TableCell>{edition.published_year ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TablePanel>

        <TablePanel
          title="Copies"
          description="Recent member copies already admitted into the system."
          totalLabel={`${filteredCopies.length} shown`}
          searchPlaceholder="Search copies by title, ISBN, member, or user ID"
          query={copyQuery}
          onQueryChange={setCopyQuery}
          sortValue={copySort}
          onSortChange={(value) => setCopySort(value as CopiesSort)}
          sortOptions={[
            { value: "latest_desc", label: "Sort: Latest" },
            { value: "title_asc", label: "Sort: Title" },
            { value: "status_asc", label: "Sort: Status" },
          ]}
          filterValue={copyStatusFilter}
          onFilterChange={setCopyStatusFilter}
          filterOptions={[
            { value: "all", label: "Status: All" },
            ...availableCopyStatuses.map((value) => ({
              value,
              label: `Status: ${value}`,
            })),
          ]}
        >
          {copiesQuery.isError ? (
            <p className="text-sm text-red-700">
              {copiesQuery.error instanceof Error
                ? copiesQuery.error.message
                : "Failed to load copies."}
            </p>
          ) : copiesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading copies...</p>
          ) : filteredCopies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No copies match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Share Type</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCopies.map((copy) => (
                  <TableRow key={copy.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{copy.edition?.book?.title ?? "Untitled"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{copy.edition?.isbn || "No ISBN"}</p>
                    </TableCell>
                    <TableCell>{memberNamesById.get(copy.user_id) ?? copy.user_id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{copy.status}</Badge>
                    </TableCell>
                    <TableCell>{copy.share_type || "—"}</TableCell>
                    <TableCell>{formatDate(copy.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TablePanel>

        <TablePanel
          title="Wishes"
          description="Recent member wishes already stored in the platform."
          totalLabel={`${filteredWishes.length} shown`}
          searchPlaceholder="Search wishes by title, ISBN, member, or user ID"
          query={wishQuery}
          onQueryChange={setWishQuery}
          sortValue={wishSort}
          onSortChange={(value) => setWishSort(value as WishesSort)}
          sortOptions={[
            { value: "latest_desc", label: "Sort: Latest" },
            { value: "title_asc", label: "Sort: Title" },
            { value: "status_asc", label: "Sort: Status" },
          ]}
          filterValue={wishStatusFilter}
          onFilterChange={setWishStatusFilter}
          filterOptions={[
            { value: "all", label: "Status: All" },
            ...availableWishStatuses.map((value) => ({
              value,
              label: `Status: ${value}`,
            })),
          ]}
        >
          {wishesQuery.isError ? (
            <p className="text-sm text-red-700">
              {wishesQuery.error instanceof Error
                ? wishesQuery.error.message
                : "Failed to load wishes."}
            </p>
          ) : wishesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading wishes...</p>
          ) : filteredWishes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wishes match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Edition</TableHead>
                  <TableHead>Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWishes.map((wish) => (
                  <TableRow key={wish.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{wish.book?.title ?? "Untitled"}</p>
                      {wish.book?.subtitle ? (
                        <p className="mt-1 text-xs text-muted-foreground">{wish.book.subtitle}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>{memberNamesById.get(wish.user_id) ?? wish.user_id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{wish.status}</Badge>
                    </TableCell>
                    <TableCell>{wish.edition?.isbn || "Any edition"}</TableCell>
                    <TableCell>{formatDate(wish.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TablePanel>
      </div>
    </section>
  );
}
