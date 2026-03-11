import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="auth-page">
      <Card className="auth-card">
        <CardHeader className="space-y-2 pb-4">
          <p className="auth-eyebrow">BookShare Identity</p>
          <CardTitle className="auth-title">{title}</CardTitle>
          {description ? (
            <CardDescription className="auth-subtitle">{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4 pt-0">{children}</CardContent>
      </Card>
    </main>
  );
}
