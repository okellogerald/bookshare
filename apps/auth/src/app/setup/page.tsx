import { redirect } from "next/navigation";
import { KratosFlowForm } from "@/components/kratos-flow-form";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
  initBrowserFlow,
} from "@/lib/kratos";
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
  const setupStepParam = getSingleParam(params, "step");
  const setupStep = setupStepParam === "profile" ? "profile" : "password";

  if (!flowId) {
    const newFlowId = await initBrowserFlow("settings", returnTo);
    if (newFlowId) {
      const query = new URLSearchParams({ flow: newFlowId, step: setupStep });
      if (returnTo) query.set("return_to", returnTo);
      redirect(`/setup?${query.toString()}`);
    }

    redirect(createBrowserFlowUrl("settings", returnTo));
  }

  const flow = await getBrowserFlow("settings", flowId);
  if (!flow) {
    const newFlowId = await initBrowserFlow("settings", returnTo);
    if (newFlowId) {
      const query = new URLSearchParams({ flow: newFlowId, step: setupStep });
      if (returnTo) query.set("return_to", returnTo);
      redirect(`/setup?${query.toString()}`);
    }

    redirect(createBrowserFlowUrl("settings", returnTo));
  }

  const allMessages = [
    ...(flow.ui.messages || []),
    ...flow.ui.nodes.flatMap((node) => node.messages || []),
  ];
  const hasSuccessMessage = allMessages.some((message) => message.type === "success");

  if (setupStep === "password" && hasSuccessMessage) {
    const nextQuery = new URLSearchParams({ flow: flow.id, step: "profile" });
    if (returnTo) nextQuery.set("return_to", returnTo);
    redirect(`/setup?${nextQuery.toString()}`);
  }

  if (setupStep === "profile" && hasSuccessMessage) {
    if (returnTo) {
      redirect(returnTo);
    }
    redirect("/login");
  }

  const accountEmail = (() => {
    const identityTraits = flow.identity?.traits;
    if (
      identityTraits &&
      typeof identityTraits === "object" &&
      typeof (identityTraits as { email?: unknown }).email === "string"
    ) {
      const value = (identityTraits as { email?: string }).email?.trim();
      if (value) return value;
    }

    const emailNode = flow.ui.nodes.find(
      (node) => node.type === "input" && node.attributes.name === "traits.email"
    );
    return typeof emailNode?.attributes.value === "string"
      ? emailNode.attributes.value.trim()
      : "";
  })();

  const title =
    setupStep === "password" ? "Set your password" : "Create your profile";
  const description =
    setupStep === "password"
      ? accountEmail
        ? `Choose a password for ${accountEmail}.`
        : "Choose a password for your account first."
      : accountEmail
        ? `Now complete your profile details for ${accountEmail}.`
        : "Now complete your basic profile details.";
  const sectionGroups = setupStep === "password" ? ["password"] : ["profile"];
  const fieldAllowlist =
    setupStep === "password"
      ? ["password"]
      : ["traits.email", "traits.name.first", "traits.name.last", "traits.gender"];
  const links =
    setupStep === "password"
      ? [{ href: "/login", label: "Back to sign in" }]
      : [
        {
          href: `/setup?flow=${encodeURIComponent(flow.id)}&step=password${returnTo ? `&return_to=${encodeURIComponent(returnTo)}` : ""}`,
          label: "Back to password",
        },
      ];

  return (
    <KratosFlowForm
      flow={flow}
      title={title}
      description={description}
      sectionGroups={sectionGroups}
      fieldAllowlist={fieldAllowlist}
      readonlyFieldNames={setupStep === "profile" ? ["traits.email"] : []}
      submitAllowlist={["method"]}
      hideBackOnlySections
      links={links}
      enablePasswordConfirmation={setupStep === "password"}
    />
  );
}
