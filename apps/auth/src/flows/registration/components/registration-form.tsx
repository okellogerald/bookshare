import { AuthShell } from "@/shared/components/auth-shell";
import { FlowFooterLinks } from "@/shared/components/flow/footer-links";
import { Alert } from "@/shared/components/ui/alert";
import type {
  RegistrationPageModel,
} from "../server/build-registration-model";
import { RegistrationPasswordStepForm } from "./registration-password-step-form";
import { RegistrationProfileStepForm } from "./registration-profile-step-form";

interface RegistrationFormProps {
  model: RegistrationPageModel;
}

export function RegistrationForm({ model }: RegistrationFormProps) {
  if (model.variant === "existing-account") {
    const description = model.email
      ? `An account for ${model.email} already exists. Sign in with that account or reset the password if you need to regain access.`
      : "An account with that email already exists. Sign in with that account or reset the password if you need to regain access.";

    return (
      <AuthShell
        title="Account already exists"
        description={description}
      >
        <Alert className="border-border text-foreground">
          If this is your account and the email is not verified yet, sign in and the auth flow will take you to verification.
        </Alert>
        <FlowFooterLinks
          links={[
            { href: model.loginHref, label: "Sign in" },
            { href: model.recoveryHref, label: "Reset password" },
            { href: model.resetHref, label: "Try another email" },
          ]}
        />
      </AuthShell>
    );
  }

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
