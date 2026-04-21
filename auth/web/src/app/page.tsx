import NextLink from "next/link";
import { AuthShell } from "@/shared/components/auth-shell";

export default function HomePage() {
  return (
    <AuthShell
      title="BookShare Auth Portal"
      description="Central authentication UI and OAuth challenge handler."
    >
      <div className="space-y-2">
        <NextLink href="/register" className="auth-home-link">
          Register
        </NextLink>
        <NextLink href="/login" className="auth-home-link">
          Login
        </NextLink>
        <NextLink href="/recovery" className="auth-home-link">
          Password Recovery
        </NextLink>
        <NextLink href="/verification" className="auth-home-link">
          Email Verification
        </NextLink>
        <NextLink href="/settings?section=profile" className="auth-home-link">
          Profile Settings
        </NextLink>
        <NextLink href="/settings?section=password" className="auth-home-link">
          Password Changes
        </NextLink>
        <NextLink href="/organizations" className="auth-home-link">
          Organizations
        </NextLink>
      </div>
    </AuthShell>
  );
}
