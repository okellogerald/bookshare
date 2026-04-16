import { AuthShell } from "@/shared/components/auth-shell";
import { FlowFooterLinks } from "@/shared/components/flow/footer-links";
import { Alert } from "@/shared/components/ui/alert";
import type { RecoveryPageModel } from "../server/build-recovery-model";
import { RecoveryCodeStepForm } from "./recovery-code-step-form";
import { RecoveryEmailStepForm } from "./recovery-email-step-form";

interface RecoveryFormProps {
  model: RecoveryPageModel;
}

export function RecoveryForm({ model }: RecoveryFormProps) {
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
    <RecoveryEmailStepForm model={model} />
  ) : (
    <RecoveryCodeStepForm model={model} />
  );
}
