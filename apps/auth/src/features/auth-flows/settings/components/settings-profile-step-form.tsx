import { AuthShell } from "@/components/auth-shell";
import { FlowFooterLinks } from "@/components/flow/footer-links";
import { FlowMessages } from "@/components/flow/messages";
import { Button } from "@/components/ui/button";
import type { SettingsProfileStepModel } from "../server/build-settings-model";
import { SettingsGenderField, SettingsTextField } from "./settings-fields";

interface SettingsProfileStepFormProps {
  model: SettingsProfileStepModel;
}

export function SettingsProfileStepForm({
  model,
}: SettingsProfileStepFormProps) {
  const description = model.accountEmail
    ? `Manage profile details for ${model.accountEmail}.`
    : "Manage your profile details.";

  return (
    <AuthShell title="Profile settings" description={description}>
      <FlowMessages messages={model.messages} />

      <form
        action={model.action}
        method={model.method}
        className="flow-form"
        data-flow-id={model.flowId}
        data-flow-kind="settings"
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

        <SettingsTextField field={model.fields.email} autoComplete="email" />
        <SettingsTextField
          field={model.fields.firstName}
          autoComplete="given-name"
        />
        <SettingsTextField
          field={model.fields.lastName}
          autoComplete="family-name"
        />
        <SettingsGenderField field={model.fields.gender} />

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
          { href: model.passwordSectionHref, label: "Password changes" },
          { href: model.backHref, label: model.backLabel },
        ]}
      />
    </AuthShell>
  );
}
