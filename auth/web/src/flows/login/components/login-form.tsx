import { HelpCircle } from "lucide-react";
import NextLink from "next/link";
import { AuthShell } from "@/shared/components/auth-shell";
import { FlowFooterLinks } from "@/shared/components/flow/footer-links";
import { FlowMessages } from "@/shared/components/flow/messages";
import { Alert } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";
import type {
  LoginFieldModel,
  LoginPageModel,
  LoginStepModel,
} from "../server/build-login-model";

interface LoginFormProps {
  model: LoginPageModel;
}

interface LoginFieldProps {
  field: LoginFieldModel;
  autoComplete: string;
}

function LoginFieldMessages({ field }: { field: LoginFieldModel }) {
  if (field.messages.length === 0) {
    return null;
  }

  return (
    <>
      {field.messages.map((message, index) => (
        <p
          key={`${message.id ?? index}-${index}`}
          className={cn("flow-node-message text-xs", `flow-node-message-${message.type}`)}
        >
          {message.text}
        </p>
      ))}
    </>
  );
}

function SwitchAccountLink({ href }: { href: string }) {
  return (
    <div className="flow-switch-account">
      <NextLink href={href} className="flow-switch-account-link">
        Use a different account
      </NextLink>
      <span
        tabIndex={0}
        role="img"
        aria-label="You'll be signed out of the current session and can sign in with a different account."
        className="flow-switch-account-trigger"
      >
        <HelpCircle className="size-4" aria-hidden />
        <span role="tooltip" className="flow-switch-account-tooltip">
          You&apos;ll be signed out of the current session and can sign in with a different account.
        </span>
      </span>
    </div>
  );
}

function LoginField({ field, autoComplete }: LoginFieldProps) {
  const fieldId = `login-${field.key}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId} className="flow-field-label">
        {field.label}
      </Label>
      <Input
        id={fieldId}
        name={field.name}
        type={field.type}
        defaultValue={field.value}
        required={field.required}
        disabled={field.disabled}
        autoComplete={autoComplete}
      />
      <LoginFieldMessages field={field} />
    </div>
  );
}

function LoginStepForm({ model }: { model: LoginStepModel }) {
  return (
    <AuthShell title="Sign in" description="Use your account to continue.">
      <FlowMessages messages={model.messages} />

      <form
        action={model.action}
        method={model.method}
        className="flow-form"
        data-flow-id={model.flowId}
        data-flow-kind="login"
      >
        {model.hiddenFields.map((field, index) => (
          <input
            key={`${field.name}-${field.group}-${index}`}
            type="hidden"
            name={field.name}
            defaultValue={field.value}
          />
        ))}

        <LoginField field={model.identifierField} autoComplete="email" />
        {model.switchAccountHref ? (
          <SwitchAccountLink href={model.switchAccountHref} />
        ) : null}
        <LoginField field={model.passwordField} autoComplete="current-password" />

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
          { href: model.registerHref, label: "Register" },
          { href: model.recoveryHref, label: "Forgot password?" },
        ]}
      />
    </AuthShell>
  );
}

export function LoginForm({ model }: LoginFormProps) {
  if (model.variant === "error") {
    return (
      <AuthShell title={model.title} description={model.description}>
        {model.detail ? (
          <Alert className="border-amber-500/50 text-amber-700">{model.detail}</Alert>
        ) : null}
        <FlowFooterLinks
          links={[
            { href: model.retryHref, label: "Start over" },
            { href: model.registerHref, label: "Register" },
            { href: model.recoveryHref, label: "Forgot password?" },
          ]}
        />
      </AuthShell>
    );
  }

  return <LoginStepForm model={model} />;
}
