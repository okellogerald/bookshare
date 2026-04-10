import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

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
        <Card className="border-border/80 bg-background/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm leading-6 text-slate-600">
            Grant and revoke internal access levels such as owner, manager, and staff.
            </CardDescription>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-background/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Access Control</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm leading-6 text-slate-600">
            Ensure admin capabilities are limited to trusted platform operators only.
            </CardDescription>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-background/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Audit Trail</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm leading-6 text-slate-600">
            Track who changed staff privileges and when those changes happened.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
