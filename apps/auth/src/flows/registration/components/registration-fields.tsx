"use client";

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
import type { RegistrationFieldModel } from "../server/build-registration-model";

interface RegistrationFieldMessagesProps {
  messages: RegistrationFieldModel["messages"];
}

function RegistrationFieldMessages({
  messages,
}: RegistrationFieldMessagesProps) {
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

interface RegistrationTextFieldProps {
  field: RegistrationFieldModel;
  autoComplete: string;
}

export function RegistrationTextField({
  field,
  autoComplete,
}: RegistrationTextFieldProps) {
  const fieldId = `registration-${field.key}`;

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
      <RegistrationFieldMessages messages={field.messages} />
    </div>
  );
}

interface RegistrationGenderFieldProps {
  field: RegistrationFieldModel;
}

export function RegistrationGenderField({
  field,
}: RegistrationGenderFieldProps) {
  const fieldId = `registration-${field.key}`;
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
      <RegistrationFieldMessages messages={field.messages} />
    </div>
  );
}
