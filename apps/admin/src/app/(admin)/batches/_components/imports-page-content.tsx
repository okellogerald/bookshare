"use client";

import { Upload } from "lucide-react";
import { useAdminFlow } from "@/app/(admin)/_flows/admin-flow-provider";
import { RecentImportRunsPanel } from "@/app/(admin)/batches/_components/recent-import-runs-panel";
import { PageIntro } from "@/shared/components/page-intro";
import { Button } from "@/shared/components/ui/button";

export function ImportsPageContent() {
  const { openFlow } = useAdminFlow();

  return (
    <section className="space-y-6">
      <PageIntro
        title="Imports"
        description="Keep recent import activity visible on the page, and launch the batch flow whenever you need to validate and commit a new ZIP."
        actions={
          <Button
            type="button"
            className="rounded-full px-4"
            onClick={() => openFlow({ kind: "import-batch" })}
          >
            <Upload className="h-4 w-4" />
            Import Batch
          </Button>
        }
      />

      <RecentImportRunsPanel />
    </section>
  );
}
