export default function StaffPage() {
  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
        Staff
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">
        Staff Management
      </h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
        Staff management is the second admin lane after catalog work. It will stay
        narrowly focused on internal operators until broader member management is
        explicitly introduced later.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.4rem] border border-border/80 bg-background/80 p-5">
          <h3 className="font-semibold">Roles</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Grant and revoke internal access levels such as owner, manager, and staff.
          </p>
        </article>
        <article className="rounded-[1.4rem] border border-border/80 bg-background/80 p-5">
          <h3 className="font-semibold">Access Control</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Ensure admin capabilities are limited to trusted platform operators only.
          </p>
        </article>
        <article className="rounded-[1.4rem] border border-border/80 bg-background/80 p-5">
          <h3 className="font-semibold">Audit Trail</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Track who changed staff privileges and when those changes happened.
          </p>
        </article>
      </div>
    </section>
  );
}
