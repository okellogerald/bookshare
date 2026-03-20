import { redirect } from "next/navigation";
import { type AuthSearchParams, getSingleParam } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const flowId = getSingleParam(params, "flow");
  const returnTo = getSingleParam(params, "return_to");
  const redirectParams = new URLSearchParams({ section: "profile" });
  if (flowId) {
    redirectParams.set("flow", flowId);
  }
  if (returnTo) {
    redirectParams.set("return_to", returnTo);
  }

  redirect(`/settings?${redirectParams.toString()}`);
}
