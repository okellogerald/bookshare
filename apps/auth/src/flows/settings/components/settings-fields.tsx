import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { SettingsFieldModel } from "../server/build-settings-model";

function SettingsFieldMessages({
  messages,
}: {
  messages: SettingsFieldModel["messages"];
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

interface SettingsTextFieldProps {
  field: SettingsFieldModel;
  autoComplete: string;
}

export function SettingsTextField({
  field,
  autoComplete,
}: SettingsTextFieldProps) {
  const fieldId = `settings-${field.key}`;

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
      <SettingsFieldMessages messages={field.messages} />
    </div>
  );
}

export function SettingsGenderField({ field }: { field: SettingsFieldModel }) {
  const fieldId = `settings-${field.key}`;
  const defaultValue = field.value.trim().length > 0 ? field.value : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId} className="flow-field-label">
        {field.label}
      </Label>
      <Select
        name={field.name}
        defaultValue={defaultValue}
        required={field.required}
        disabled={field.disabled}
      >
        <SelectTrigger id={fieldId} aria-label={field.label}>
          <SelectValue placeholder="Select gender" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="female">Female</SelectItem>
          <SelectItem value="male">Male</SelectItem>
          <SelectItem value="prefer_not_to_say">Do not Specify</SelectItem>
        </SelectContent>
      </Select>
      <SettingsFieldMessages messages={field.messages} />
    </div>
  );
}
