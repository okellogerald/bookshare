import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export default function BatchesPage() {
  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
        Batches
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">
        Batch Ingestion
      </h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
        This section will become the browser-native replacement for importer-driven
        catalog batches. It will reuse validation, preview, and transactional commit
        concepts instead of forcing staff through raw CSV commands.
      </p>

      <Card className="mt-8 border-dashed border-border/90 bg-background/70">
        <CardHeader>
          <CardTitle className="text-lg">Planned capabilities</CardTitle>
          <CardDescription>
            The browser-native ingestion path will replace command-line-only batch work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm leading-6 text-slate-700">
          <li>Paste tabular data or upload CSV files</li>
          <li>Preview validation errors before commit</li>
          <li>Spot duplicates against the live catalog</li>
          <li>Save and revisit ingestion batches</li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
