import Link from "next/link";
import { BatchIngestionWorkbench } from "@/features/batches/components/batch-ingestion-workbench";
import { Button } from "@/shared/components/ui/button";
import { PageIntro } from "@/shared/components/page-intro";

export default function BatchesPage() {
  return (
    <section className="space-y-6">
      <PageIntro
        eyebrow="Batches"
        title="Validate imports"
        description="Move through the import flow step by step: configure the run, upload the archive, review issues only when needed, and commit when the batch is ready."
        actions={
          <Button asChild variant="outline" className="rounded-full px-4">
            <Link href="/batches/runs">Recent runs</Link>
          </Button>
        }
      />

      <BatchIngestionWorkbench />
    </section>
  );
}
