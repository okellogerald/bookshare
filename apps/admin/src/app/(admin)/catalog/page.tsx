const workbenchTracks = [
  "Search existing books, editions, and linked member inventory",
  "Create books and editions without leaving the page",
  "Attach covers and catch duplicate ISBN/title collisions",
  "Create listings on behalf of a member through the same domain path as normal app writes",
];

export default function CatalogPage() {
  return (
    <section>
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

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[1.5rem] border border-border/80 bg-background/80 p-6">
          <h3 className="text-lg font-semibold">Initial workbench scope</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            {workbenchTracks.map((item) => (
              <li key={item} className="rounded-2xl bg-card px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[1.5rem] border border-border/80 bg-muted/45 p-6">
          <h3 className="text-lg font-semibold">Current phase</h3>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            The app scaffold is in place. The next implementation step is to wire
            staff authorization and the first API-backed catalog search/create path.
          </p>
        </div>
      </div>
    </section>
  );
}
