import NextLink from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function WelcomePage() {
  return (
    <AuthShell
      title="Email verification started"
      description="Check your inbox for the verification code and complete verification to continue."
    >
      <div className="flow-footer-links">
        <NextLink href="/verification" className="auth-home-link">
          Enter verification code
        </NextLink>
        <NextLink href="/login" className="auth-home-link">
          Back to sign in
        </NextLink>
      </div>
    </AuthShell>
  );
}
