"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { RecentImportRunsPanel } from "@/features/batches/components/recent-import-runs-panel";
import { ImportBatchFlow } from "@/features/batches/flows/import-batch-flow";
import { RightPanel } from "@/shared/components/right-panel";
import { PageIntro } from "@/shared/components/page-intro";
import { Button } from "@/shared/components/ui/button";

export default function BatchesPage() {
  const [importPanelOpen, setImportPanelOpen] = useState(false);

  return (
    <section className="space-y-6">
      <PageIntro
        title="Imports"
        description="Keep recent import activity visible on the page, and open the batch flow in the right panel whenever you need to validate and commit a new ZIP."
        actions={
          <Button
            type="button"
            className="rounded-full px-4"
            onClick={() => setImportPanelOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Import Batch
          </Button>
        }
      />

      <RecentImportRunsPanel />

      <RightPanel
        open={importPanelOpen}
        onClose={() => setImportPanelOpen(false)}
        title="Import batch"
        description="Validate the ZIP, inspect any issues, and commit the run when it is ready."
        size="xl"
      >
        <ImportBatchFlow />
      </RightPanel>
    </section>
  );
}
