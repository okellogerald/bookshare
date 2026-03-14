import { redirect } from "next/navigation";
import { KratosFlowForm } from "@/components/kratos-flow-form";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
} from "@/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const flowId = getSingleParam(params, "flow");
  const returnTo = getSingleParam(params, "return_to");

  if (!flowId) {
    redirect(createBrowserFlowUrl("registration", returnTo));
  }

  const flow = await getBrowserFlow("registration", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("registration", returnTo));
  }

  const loginHref = flow.return_to
    ? `/login?return_to=${encodeURIComponent(flow.return_to)}`
    : "/login";
  const isCodeStep = flow.ui.nodes.some(
    (node) => node.type === "input" && node.attributes.name === "code"
  );
  const codeEmail = (() => {
    const node = flow.ui.nodes.find(
      (item) => item.type === "input" && item.attributes.name === "traits.email"
    );
    return typeof node?.attributes.value === "string"
      ? node.attributes.value.trim()
      : "";
  })();
  const description = isCodeStep
    ? codeEmail
      ? `Enter the latest 6-digit code sent to ${codeEmail}. Keep this tab open while verifying.`
      : "Enter the latest 6-digit code sent to your email. Keep this tab open while verifying."
    : "Enter your email to start account creation.";
  const links = isCodeStep
    ? [
      { href: loginHref, label: "Back to sign in" },
      { href: "/register/reset", label: "Use a different email" },
    ]
    : [{ href: loginHref, label: "Back to sign in" }];
  const fieldAllowlist = isCodeStep
    ? ["code"]
    : ["traits.email"];

  return (
    <KratosFlowForm
      flow={flow}
      title={isCodeStep ? "Verify your email" : "Register"}
      description={description}
      sectionGroups={["code"]}
      fieldAllowlist={fieldAllowlist}
      submitAllowlist={["method"]}
      hideBackOnlySections
      links={links}
    />
  );
}
