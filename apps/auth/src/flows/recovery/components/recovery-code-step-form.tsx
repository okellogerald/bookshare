import { AuthShell } from "@/shared/components/auth-shell";
import { FlowFooterLinks } from "@/shared/components/flow/footer-links";
import { FlowMessages } from "@/shared/components/flow/messages";
import { Button } from "@/shared/components/ui/button";
import type { RecoveryCodeStepModel } from "../server/build-recovery-model";
import { RecoveryTextField } from "./recovery-fields";

interface RecoveryCodeStepFormProps {
  model: RecoveryCodeStepModel;
}

export function RecoveryCodeStepForm({ model }: RecoveryCodeStepFormProps) {
  return (
    <AuthShell
      title="Recover account"
      description="Step 2 of 2: enter the recovery code from your email."
    >
      <FlowMessages messages={model.messages} />

      <form
        action={model.action}
        method={model.method}
        className="flow-form"
        data-flow-id={model.flowId}
        data-flow-kind="recovery"
        data-flow-step="code"
      >
        {model.hiddenFields.map((field, index) => (
          <input
            key={`${field.name}-${field.group}-${index}`}
            type="hidden"
            name={field.name}
            defaultValue={field.value}
          />
        ))}

        <RecoveryTextField field={model.codeField} autoComplete="one-time-code" />

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

      {model.resendSubmit ? (
        // Resending the code is its own Kratos submission. Keeping it in a
        // dedicated form avoids mixing the resend button with the main
        // code-entry submit action.
        <form
          action={model.action}
          method={model.method}
          className="flow-form"
          data-flow-id={model.flowId}
          data-flow-kind="recovery"
          data-flow-step="resend"
        >
          {model.hiddenFields.map((field, index) => (
            <input
              key={`resend-${field.name}-${field.group}-${index}`}
              type="hidden"
              name={field.name}
              defaultValue={field.value}
            />
          ))}

          <div className="flow-actions">
            <Button
              type="submit"
              name={model.resendSubmit.name}
              value={model.resendSubmit.value}
              variant="outline"
              className="flow-submit-button"
            >
              {model.resendSubmit.label}
            </Button>
          </div>
        </form>
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
