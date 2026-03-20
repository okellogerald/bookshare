import NextLink from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function WelcomePage() {
  return (
    <AuthShell
      title="Email verified"
      description="Your email has been verified. You can sign in with your email and password."
    >
      <div className="flow-footer-links">
        <NextLink href="/login" className="auth-home-link">
          Sign in
        </NextLink>
        <NextLink href="/register" className="auth-home-link">
          Create another account
        </NextLink>
      </div>
    </AuthShell>
  );
}
