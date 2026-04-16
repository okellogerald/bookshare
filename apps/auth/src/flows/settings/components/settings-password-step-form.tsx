"use client";

import { useState, type FormEvent } from "react";
import { AuthShell } from "@/shared/components/auth-shell";
import { FlowFooterLinks } from "@/shared/components/flow/footer-links";
import { FlowMessages } from "@/shared/components/flow/messages";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { SettingsPasswordStepModel } from "../server/build-settings-model";
import { SettingsTextField } from "./settings-fields";

interface SettingsPasswordStepFormProps {
  model: SettingsPasswordStepModel;
}

export function SettingsPasswordStepForm({
  model,
}: SettingsPasswordStepFormProps) {
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

  const isRecoveryReset = model.mode === "recovery-reset";
  const title = isRecoveryReset ? "Reset password" : "Password changes";
  const description = isRecoveryReset
    ? model.accountEmail
      ? `Set a new password for ${model.accountEmail}.`
      : "Set a new password for your account."
    : model.accountEmail
      ? `Choose a new password for ${model.accountEmail}.`
      : "Choose a new password for your account.";

  return (
    <AuthShell title={title} description={description}>
      <FlowMessages messages={model.messages} />

      <form
        action={model.action}
        method={model.method}
        className="flow-form"
        onSubmit={handleSubmit}
        data-flow-id={model.flowId}
        data-flow-kind="settings"
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

        <SettingsTextField field={model.passwordField} autoComplete="new-password" />

        <div className="space-y-2">
          <Label htmlFor="settings-confirm-password" className="flow-field-label">
            Confirm password
          </Label>
          <Input
            id="settings-confirm-password"
            name="settings_confirm_password"
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
            {model.submit.label}
          </Button>
        </div>
      </form>

      <FlowFooterLinks
        links={
          isRecoveryReset
            ? [
              { href: model.retryHref, label: "Start over" },
              { href: model.backHref, label: model.backLabel },
            ]
            : [
              { href: model.profileSectionHref, label: "Profile settings" },
              { href: model.backHref, label: model.backLabel },
            ]
        }
      />
    </AuthShell>
  );
}
