"use client";

import { AuthShell } from "@/shared/components/auth-shell";
import { FlowFooterLinks } from "@/shared/components/flow/footer-links";
import { FlowMessages } from "@/shared/components/flow/messages";
import { Button } from "@/shared/components/ui/button";
import {
  RegistrationGenderField,
  RegistrationTextField,
} from "./registration-fields";
import type { RegistrationProfileStepModel } from "../server/build-registration-model";

interface RegistrationProfileStepFormProps {
  model: RegistrationProfileStepModel;
}

export function RegistrationProfileStepForm({
  model,
}: RegistrationProfileStepFormProps) {
  return (
    <AuthShell
      title="Create your account"
      description={`Step ${model.stepNumber} of ${model.totalSteps}: enter your profile details.`}
    >
      <FlowMessages messages={model.messages} />

      <form
        action={model.action}
        method={model.method}
        className="flow-form"
        data-flow-id={model.flowId}
        data-flow-kind="registration"
        data-flow-step="profile"
      >
        {model.hiddenFields.map((field, index) => (
          <input
            key={`${field.name}-${field.group}-${index}`}
            type="hidden"
            name={field.name}
            defaultValue={field.value}
          />
        ))}

        <RegistrationTextField field={model.fields.email} autoComplete="email" />
        <RegistrationTextField
          field={model.fields.firstName}
          autoComplete="given-name"
        />
        <RegistrationTextField
          field={model.fields.lastName}
          autoComplete="family-name"
        />
        <RegistrationGenderField field={model.fields.gender} />

        <div className="flow-actions">
          <Button
            type="submit"
            name={model.submit.name}
            value={model.submit.value}
            className="flow-submit-button"
          >
            Continue
          </Button>
        </div>
      </form>

      <FlowFooterLinks
        links={[
          { href: model.resetHref, label: "Start over" },
          { href: model.loginHref, label: "Back to sign in" },
        ]}
      />
    </AuthShell>
  );
}
