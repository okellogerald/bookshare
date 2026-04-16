import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { VerificationFieldModel } from "../server/build-verification-model";

function VerificationFieldMessages({
  messages,
}: {
  messages: VerificationFieldModel["messages"];
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <>
      {messages.map((message, index) => (
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

interface VerificationTextFieldProps {
  field: VerificationFieldModel;
  autoComplete: string;
}

export function VerificationTextField({
  field,
  autoComplete,
}: VerificationTextFieldProps) {
  const fieldId = `verification-${field.key}`;

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
      <VerificationFieldMessages messages={field.messages} />
    </div>
  );
}
