import { CatalogWorkbench } from "@/features/catalog/components/catalog-workbench";
import { PageIntro } from "@/shared/components/page-intro";

export default function CatalogPage() {
  return (
    <section className="space-y-6">
      <PageIntro
        title="Catalog workbench"
        description="Search current records before creating anything new, then inspect the best match in a clean, low-noise workspace."
      />

      <CatalogWorkbench />
    </section>
  );
}
