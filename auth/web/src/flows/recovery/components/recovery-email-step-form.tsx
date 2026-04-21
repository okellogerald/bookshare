import { AuthShell } from "@/shared/components/auth-shell";
import { FlowFooterLinks } from "@/shared/components/flow/footer-links";
import { FlowMessages } from "@/shared/components/flow/messages";
import { Button } from "@/shared/components/ui/button";
import type { RecoveryEmailStepModel } from "../server/build-recovery-model";
import { RecoveryTextField } from "./recovery-fields";

interface RecoveryEmailStepFormProps {
  model: RecoveryEmailStepModel;
}

export function RecoveryEmailStepForm({ model }: RecoveryEmailStepFormProps) {
  return (
    <AuthShell
      title="Recover account"
      description="Step 1 of 2: enter your email address to receive a recovery code."
    >
      <FlowMessages messages={model.messages} />

      <form
        action={model.action}
        method={model.method}
        className="flow-form"
        data-flow-id={model.flowId}
        data-flow-kind="recovery"
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

        <RecoveryTextField field={model.emailField} autoComplete="email" />

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
