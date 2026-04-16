import { redirect } from "next/navigation";
import { buildAuthPortalVerificationUrl } from "@/domains/auth/lib/auth-portal";

export default function VerificationRedirectPage() {
  redirect(buildAuthPortalVerificationUrl());
}
