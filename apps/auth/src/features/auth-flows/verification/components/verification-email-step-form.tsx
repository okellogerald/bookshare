import { AuthShell } from "@/components/auth-shell";
import { FlowFooterLinks } from "@/components/flow/footer-links";
import { FlowMessages } from "@/components/flow/messages";
import { Button } from "@/components/ui/button";
import type { VerificationEmailStepModel } from "../server/build-verification-model";
import { VerificationTextField } from "./verification-fields";

interface VerificationEmailStepFormProps {
  model: VerificationEmailStepModel;
}

export function VerificationEmailStepForm({
  model,
}: VerificationEmailStepFormProps) {
  return (
    <AuthShell
      title="Verify email"
      description="Step 1 of 2: enter the email address to send a verification code."
    >
      <FlowMessages messages={model.messages} />

      <form
        action={model.action}
        method={model.method}
        className="flow-form"
        data-flow-id={model.flowId}
        data-flow-kind="verification"
        data-flow-step="email"
      >
        {model.hiddenFields.map((field, index) => (
          <input
            key={`${field.name}-${field.group}-${index}`}
            type="hidden"
            name={field.name}
            defaultValue={field.value}
          />
        ))}

        <VerificationTextField field={model.emailField} autoComplete="email" />

        <div className="flow-actions">
          <Button
            type="submit"
            name={model.submit.name}
            value={model.submit.value}
            className="flow-submit-button"
          >
            {model.submit.label}
          </Button>
        </div>
      </form>

      <FlowFooterLinks
        links={[
          { href: model.retryHref, label: "Start over" },
          { href: model.loginHref, label: "Back to sign in" },
        ]}
      />
    </AuthShell>
  );
}
