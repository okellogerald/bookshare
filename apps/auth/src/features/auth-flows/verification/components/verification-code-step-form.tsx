import { AuthShell } from "@/components/auth-shell";
import { FlowFooterLinks } from "@/components/flow/footer-links";
import { FlowMessages } from "@/components/flow/messages";
import { Button } from "@/components/ui/button";
import type { VerificationCodeStepModel } from "../server/build-verification-model";
import { VerificationTextField } from "./verification-fields";

interface VerificationCodeStepFormProps {
  model: VerificationCodeStepModel;
}

export function VerificationCodeStepForm({
  model,
}: VerificationCodeStepFormProps) {
  return (
    <AuthShell
      title="Verify email"
      description="Step 2 of 2: enter the verification code from your email."
    >
      <FlowMessages messages={model.messages} />

      <form
        action={model.action}
        method={model.method}
        className="flow-form"
        data-flow-id={model.flowId}
        data-flow-kind="verification"
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

        <VerificationTextField field={model.codeField} autoComplete="one-time-code" />

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
        // Resending the code is a distinct Kratos submit action. It gets its
        // own form so the resend button can post the required hidden flow state
        // without interfering with the main code-entry submission.
        <form
          action={model.action}
          method={model.method}
          className="flow-form"
          data-flow-id={model.flowId}
          data-flow-kind="verification"
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
