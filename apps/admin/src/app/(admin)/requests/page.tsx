import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { PageIntro } from "@/shared/components/page-intro";

const requestBuckets = [
  {
    title: "Copy requests",
    description:
      "Reserved for member-submitted copy intake that staff will review and complete here.",
  },
  {
    title: "Missing title requests",
    description:
      "Reserved for missing-title and wishlist escalations that need catalog follow-up.",
  },
];

export default function RequestsPage() {
  return (
    <section className="space-y-6">
      <PageIntro
        title="Requests"
        description="Keep request handling as its own operational area. The intake and resolution flows will land here next."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {requestBuckets.map((bucket) => (
          <Card key={bucket.title}>
            <CardHeader>
              <CardTitle>{bucket.title}</CardTitle>
              <CardDescription>{bucket.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No live workflow on this surface yet.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
