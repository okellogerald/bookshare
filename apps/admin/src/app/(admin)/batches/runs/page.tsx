import { RecentImportRunsPanel } from "@/features/batches/components/recent-import-runs-panel";
import { PageIntro } from "@/shared/components/page-intro";

export default function BatchRunsPage() {
  return (
    <section className="space-y-6">
      <PageIntro
        eyebrow="Batches"
        title="Recent runs"
        description="Keep historical import activity nearby, but separate from the step-by-step validation flow."
      />

      <RecentImportRunsPanel />
    </section>
  );
}
