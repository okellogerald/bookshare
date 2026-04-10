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

      <div className="mt-8 rounded-[1.5rem] border border-dashed border-border/90 bg-background/70 p-6">
        <h3 className="text-lg font-semibold">Planned capabilities</h3>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          <li>Paste tabular data or upload CSV files</li>
          <li>Preview validation errors before commit</li>
          <li>Spot duplicates against the live catalog</li>
          <li>Save and revisit ingestion batches</li>
        </ul>
      </div>
    </section>
  );
}
