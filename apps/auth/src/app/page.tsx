import NextLink from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function HomePage() {
  return (
    <AuthShell
      title="BookShare Auth Portal"
      description="Central authentication UI and OAuth challenge handler."
    >
      <div className="space-y-2">
        <NextLink href="/login" className="auth-home-link">
          Login
        </NextLink>
        <NextLink href="/register" className="auth-home-link">
          Registration
        </NextLink>
        <NextLink href="/recovery" className="auth-home-link">
          Password Recovery
        </NextLink>
        <NextLink href="/verification" className="auth-home-link">
          Email Verification
        </NextLink>
        <NextLink href="/setup" className="auth-home-link">
          Finish Account Setup
        </NextLink>
        <NextLink href="/settings" className="auth-home-link">
          Settings / 2FA
        </NextLink>
      </div>
    </AuthShell>
  );
}
