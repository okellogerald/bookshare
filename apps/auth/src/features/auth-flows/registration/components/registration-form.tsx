import { AuthShell } from "@/components/auth-shell";
import { FlowFooterLinks } from "@/components/flow/footer-links";
import { Alert } from "@/components/ui/alert";
import type {
  RegistrationPageModel,
} from "../server/build-registration-model";
import { RegistrationPasswordStepForm } from "./registration-password-step-form";
import { RegistrationProfileStepForm } from "./registration-profile-step-form";

interface RegistrationFormProps {
  model: RegistrationPageModel;
}

export function RegistrationForm({ model }: RegistrationFormProps) {
  if (model.variant === "error") {
    return (
      <AuthShell title={model.title} description={model.description}>
        {model.detail ? (
          <Alert className="border-amber-500/50 text-amber-700">{model.detail}</Alert>
        ) : null}
        <FlowFooterLinks
          links={[
            { href: model.resetHref, label: "Start over" },
            { href: model.loginHref, label: "Back to sign in" },
          ]}
        />
      </AuthShell>
    );
  }

  return model.variant === "profile" ? (
    <RegistrationProfileStepForm model={model} />
  ) : (
    <RegistrationPasswordStepForm model={model} />
  );
}
