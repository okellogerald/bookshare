"use client";

import { useState } from "react";
import { Plus, Search, Upload } from "lucide-react";
import { CatalogWorkbench } from "@/features/catalog/components/catalog-workbench";
import { ImportBatchFlow } from "@/features/batches/flows/import-batch-flow";
import { AddEditionFlow } from "@/features/catalog/flows/add-edition-flow";
import { RightPanel } from "@/shared/components/right-panel";
import { PageIntro } from "@/shared/components/page-intro";
import { Button } from "@/shared/components/ui/button";

type CatalogFlow = "edition" | "import" | null;

export default function CatalogPage() {
  const [activeFlow, setActiveFlow] = useState<CatalogFlow>(null);

  return (
    <section className="space-y-6">
      <PageIntro
        title="Catalog workbench"
        description="Review the titles already in the catalog, keep an eye on overall inventory volume, and use the right-side flows to add editions or run larger batch imports without leaving this workspace."
        actions={
          <>
            <Button
              type="button"
              className="rounded-full px-4"
              onClick={() => setActiveFlow("edition")}
            >
              <Plus className="h-4 w-4" />
              Add New Edition
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-4"
              onClick={() => setActiveFlow("import")}
            >
              <Upload className="h-4 w-4" />
              Import Batch
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-4"
              onClick={() => setActiveFlow("import")}
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
          </>
        }
      />

      <CatalogWorkbench />

      <RightPanel
        open={activeFlow !== null}
        onClose={() => setActiveFlow(null)}
        title={activeFlow === "import" ? "Import batch" : "Add new edition"}
        description={
          activeFlow === "import"
            ? "Validate the ZIP, review issues, and commit when the run is ready."
            : "Add an edition here. If the title does not exist yet, the flow will create it first."
        }
        size={activeFlow === "import" ? "xl" : "lg"}
      >
        {activeFlow === "import" ? (
          <ImportBatchFlow />
        ) : (
          <AddEditionFlow onClose={() => setActiveFlow(null)} />
        )}
      </RightPanel>
    </section>
  );
}
