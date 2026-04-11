import { BatchIngestionWorkbench } from "@/features/batches/components/batch-ingestion-workbench";
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
        This is now the first path for actually adding books into BookShare from the
        admin app. It reuses the importer run model, but moves validation and commit
        into the browser.
      </p>

      <div className="mt-8 space-y-4">
        <BatchIngestionWorkbench />

        <Card className="border-dashed border-border/90 bg-background/70">
          <CardHeader>
            <CardTitle className="text-lg">Current scope</CardTitle>
            <CardDescription>
              This slice is optimized for getting books and editions into the platform
              without returning to the terminal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm leading-6 text-slate-700">
              <li>Upload the importer ZIP directly from the admin UI</li>
              <li>Preview validation errors before commit</li>
              <li>Persist import runs and commit validated ones from the browser</li>
              <li>Keep recent runs visible for follow-up work</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
