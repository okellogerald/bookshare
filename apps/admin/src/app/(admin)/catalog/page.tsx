import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { CatalogWorkbench } from "@/features/catalog/components/catalog-workbench";

export default function CatalogPage() {
  return (
    <section className="space-y-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
        Catalog
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">
        Catalog Workbench
      </h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
        This is the first functional target for the admin app. The goal is to
        replace ad hoc catalog maintenance and prepare the path toward a browser
        batch-ingestion flow.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <CatalogWorkbench />
        <Card className="border-border/80 bg-muted/45">
          <CardHeader>
            <CardTitle className="text-lg">Current phase</CardTitle>
            <CardDescription>
              The workbench now starts with a live catalog search path inside the
              same app structure conventions used by `apps/web`.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
            <p>Next up is create/edit flow wiring through staff-only API endpoints.</p>
            <p>
              That will extend this screen from search and inspection into actual
              catalog operations.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
