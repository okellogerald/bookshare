import { AuthShell } from "@/components/auth-shell";
import { FlowFooterLinks } from "@/components/flow/footer-links";
import { Alert } from "@/components/ui/alert";
import type { VerificationPageModel } from "../server/build-verification-model";
import { VerificationCodeStepForm } from "./verification-code-step-form";
import { VerificationEmailStepForm } from "./verification-email-step-form";

interface VerificationFormProps {
  model: VerificationPageModel;
}

export function VerificationForm({ model }: VerificationFormProps) {
  if (model.variant === "error") {
    return (
      <AuthShell title={model.title} description={model.description}>
        {model.detail ? (
          <Alert className="border-amber-500/50 text-amber-700">{model.detail}</Alert>
        ) : null}
        <FlowFooterLinks
          links={[
            { href: model.retryHref, label: "Start over" },
            { href: model.loginHref, label: "Back to sign in" },
          ]}
        />
      </AuthShell>
    );
  }

  return model.variant === "email" ? (
    <VerificationEmailStepForm model={model} />
  ) : (
    <VerificationCodeStepForm model={model} />
  );
}
