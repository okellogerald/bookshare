import { redirect } from "next/navigation";
import { buildAuthPortalVerificationUrl } from "@/features/auth/lib/auth-portal";

export default function VerificationRedirectPage() {
  redirect(buildAuthPortalVerificationUrl());
}
