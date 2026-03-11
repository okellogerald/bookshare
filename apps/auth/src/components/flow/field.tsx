"use client";

import type { FormEvent } from "react";
import {
  type KratosUiNodeLike,
  getFieldAutoComplete,
  getNodeLabel,
} from "@/lib/kratos-ui";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SupportedTextFieldType =
  | "date"
  | "datetime-local"
  | "email"
  | "hidden"
  | "month"
  | "number"
  | "password"
  | "search"
  | "tel"
  | "text"
  | "time"
  | "url"
  | "week";

interface FlowFieldProps {
  node: KratosUiNodeLike;
  index: number;
  actionUrl: string;
  sectionKey: string;
  readOnly?: boolean;
}

function toFieldId(name: string): string {
  return `field-${name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function toSupportedType(value: string): SupportedTextFieldType {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "date":
    case "datetime-local":
    case "email":
    case "hidden":
    case "month":
    case "number":
    case "password":
    case "search":
    case "tel":
    case "text":
    case "time":
    case "url":
    case "week":
      return normalized;
    default:
      return "text";
  }
}

function normalizeOneTimeCode(raw: string): string {
  return raw.replace(/[^\d]/g, "").slice(0, 6);
}

export function FlowField({
  node,
  index,
  actionUrl,
  sectionKey,
  readOnly = false,
}: FlowFieldProps) {
  const name = node.attributes.name || `field-${index}`;
  const fieldId = toFieldId(`${sectionKey}-${name}-${index}`);
  const inputType = node.attributes.type || "text";
  const isCheckbox = inputType === "checkbox";
  const isCodeField = name === "code" || name.endsWith("_code");
  const isGenderField = name === "traits.gender";
  const resolvedInputType = isCodeField ? "text" : toSupportedType(inputType);
  const selectValue =
    typeof node.attributes.value === "string" && node.attributes.value.trim().length > 0
      ? node.attributes.value
      : undefined;
  const handleCodeInput = (event: FormEvent<HTMLInputElement>) => {
    if (!isCodeField) return;
    const normalized = normalizeOneTimeCode(event.currentTarget.value);
    if (event.currentTarget.value !== normalized) {
      event.currentTarget.value = normalized;
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId} className="flow-field-label">
        {getNodeLabel(node)}
      </Label>

      {isCheckbox ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={fieldId}
            name={name}
            value={node.attributes.value || "true"}
            defaultChecked={
              node.attributes.value === "true" || node.attributes.value === "on"
            }
            required={Boolean(node.attributes.required)}
            disabled={Boolean(node.attributes.disabled)}
          />
        </div>
      ) : isGenderField ? (
        <Select
          name={name}
          defaultValue={selectValue}
          disabled={Boolean(node.attributes.disabled)}
        >
          <SelectTrigger id={fieldId} aria-label="Gender">
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="prefer_not_to_say">Do not Specify</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Input
          className="flow-input-root"
          id={fieldId}
          name={name}
          type={resolvedInputType}
          defaultValue={
            typeof node.attributes.value === "string" ? node.attributes.value : ""
          }
          required={Boolean(node.attributes.required)}
          disabled={Boolean(node.attributes.disabled)}
          autoComplete={getFieldAutoComplete(name, inputType, actionUrl)}
          inputMode={isCodeField ? "numeric" : undefined}
          placeholder={isCodeField ? "6-digit code" : undefined}
          onInput={isCodeField ? handleCodeInput : undefined}
          autoCorrect={isCodeField ? "off" : undefined}
          spellCheck={isCodeField ? false : undefined}
          readOnly={readOnly}
        />
      )}

      {node.messages?.map((message, messageIdx) => (
        <p
          key={`${name}-message-${message.id ?? messageIdx}`}
          className={cn("flow-node-message text-xs", `flow-node-message-${message.type}`)}
        >
          {message.text}
        </p>
      ))}
    </div>
  );
}
