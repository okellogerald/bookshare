import { AuthShell } from "@/shared/components/auth-shell";
import { FlowFooterLinks } from "@/shared/components/flow/footer-links";
import { Alert } from "@/shared/components/ui/alert";
import type { SettingsPageModel } from "../server/build-settings-model";
import { SettingsPasswordStepForm } from "./settings-password-step-form";
import { SettingsProfileStepForm } from "./settings-profile-step-form";

interface SettingsFormProps {
  model: SettingsPageModel;
}

export function SettingsForm({ model }: SettingsFormProps) {
  if (model.variant === "error") {
    return (
      <AuthShell title={model.title} description={model.description}>
        {model.detail ? (
          <Alert className="border-amber-500/50 text-amber-700">{model.detail}</Alert>
        ) : null}
        <FlowFooterLinks
          links={
            model.mode === "recovery-reset"
              ? [
                { href: model.retryHref, label: "Start over" },
                { href: model.backHref, label: model.backLabel },
              ]
              : [
                { href: model.retryHref, label: "Start over" },
                { href: model.backHref, label: model.backLabel },
              ]
          }
        />
      </AuthShell>
    );
  }

  return model.variant === "profile" ? (
    <SettingsProfileStepForm model={model} />
  ) : (
    <SettingsPasswordStepForm model={model} />
  );
}
