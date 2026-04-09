"use client";

import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { FlowFooterLinks } from "@/components/flow/footer-links";
import { FlowMessages } from "@/components/flow/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RegistrationTextField } from "./registration-fields";
import type { RegistrationPasswordStepModel } from "../server/build-registration-model";

interface RegistrationPasswordStepFormProps {
  model: RegistrationPasswordStepModel;
}

export function RegistrationPasswordStepForm({
  model,
}: RegistrationPasswordStepFormProps) {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const passwordInput = event.currentTarget.elements.namedItem(model.passwordField.name);
    const password =
      passwordInput instanceof HTMLInputElement ? passwordInput.value : "";
    const confirmation = confirmPassword.trim();

    if (confirmation.length === 0) {
      event.preventDefault();
      setConfirmError("Please confirm your password.");
      return;
    }

    if (password !== confirmation) {
      event.preventDefault();
      setConfirmError("Passwords do not match.");
      return;
    }

    setConfirmError(null);
  };

  return (
    <AuthShell
      title="Create your account"
      description={`Step ${model.stepNumber} of ${model.totalSteps}: set your password.`}
    >
      <FlowMessages messages={model.messages} />

      <form
        action={model.action}
        method={model.method}
        className="flow-form"
        onSubmit={handleSubmit}
        data-flow-id={model.flowId}
        data-flow-kind="registration"
        data-flow-step="password"
      >
        {model.hiddenFields.map((field, index) => (
          <input
            key={`${field.name}-${field.group}-${index}`}
            type="hidden"
            name={field.name}
            defaultValue={field.value}
          />
        ))}

        <RegistrationTextField
          field={model.passwordField}
          autoComplete="new-password"
        />

        <div className="space-y-2">
          <Label htmlFor="registration-confirm-password" className="flow-field-label">
            Confirm password
          </Label>
          <Input
            id="registration-confirm-password"
            name="registration_confirm_password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.currentTarget.value);
              if (confirmError) {
                setConfirmError(null);
              }
            }}
          />
        </div>

        {confirmError ? (
          <p className="flow-node-message flow-node-message-error text-xs">
            {confirmError}
          </p>
        ) : null}

        <div className="flow-actions">
          <Button
            type="submit"
            name={model.submit.name}
            value={model.submit.value}
            className="flow-submit-button"
          >
            Create account
          </Button>
        </div>
      </form>

      {model.previousStepSubmit ? (
        // Kratos models "Back" as another flow submission, not client-side
        // navigation. This separate form resubmits the hidden flow state with
        // the previous-step submit values so step 2 can move back to step 1
        // without running password confirmation logic.
        <form
          action={model.action}
          method={model.method}
          className="flow-form"
          data-flow-id={model.flowId}
          data-flow-kind="registration"
          data-flow-step="password-back"
        >
          {model.hiddenFields.map((field, index) => (
            <input
              key={`back-${field.name}-${field.group}-${index}`}
              type="hidden"
              name={field.name}
              defaultValue={field.value}
            />
          ))}
          <div className="flow-actions">
            <Button
              type="submit"
              name={model.previousStepSubmit.name}
              value={model.previousStepSubmit.value}
              variant="outline"
              className="flow-submit-button"
            >
              {model.previousStepSubmit.label}
            </Button>
          </div>
        </form>
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
