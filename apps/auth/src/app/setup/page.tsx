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
  const redirectParams = new URLSearchParams({ section: "profile" });
  if (flowId) {
    redirectParams.set("flow", flowId);
  }

  redirect(`/settings?${redirectParams.toString()}`);
}
