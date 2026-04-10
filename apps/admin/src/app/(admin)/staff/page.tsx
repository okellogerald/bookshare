import { getSession } from "@/features/auth/lib/session";
import { StaffManagement } from "@/features/staff/components/staff-management";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export default async function StaffPage() {
  const session = await getSession();
  const actorRoles = session?.user.roles ?? [];

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

      <div className="mt-8 space-y-4">
        <StaffManagement actorRoles={actorRoles} />

        <Card className="border-dashed border-border/90 bg-background/75">
          <CardHeader>
            <CardTitle className="text-lg">What comes next</CardTitle>
            <CardDescription>
              This v0 keeps staff management operational and intentionally narrow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
            <p>Next, we can surface who granted each role and when.</p>
            <p>
              After that, the same admin shell can take on member management and
              create-on-behalf flows without colliding with the future bookstore app.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
