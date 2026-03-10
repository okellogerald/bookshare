import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <BookOpen className="h-12 w-12" />
        <h1 className="text-4xl font-bold tracking-tight">BookShare</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          A private community book-sharing directory. Browse books available
          from fellow members, and list your own for lending, selling, or
          giving away.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button size="lg" asChild>
          <Link href="/api/auth/login">Sign In</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/auth/register">Create Account</Link>
        </Button>
      </div>
    </div>
  );
}
