export interface KratosUiNodeLike {
  type: "input";
  group: string;
  messages: Array<{
    id?: number;
    text: string;
    type: "error" | "info" | "success" | "warning";
  }>;
  meta?: {
    label?: {
      id?: number;
      text?: string;
      type?: string;
      context?: Record<string, unknown>;
    };
  };
  attributes: {
    name?: string;
    type?: string;
    value?: string;
    required?: boolean;
    disabled?: boolean;
    autocomplete?: string;
  };
}

export function getNodeLabel(node: KratosUiNodeLike): string {
  const explicit = node.meta?.label?.text?.trim();
  if (explicit) return explicit;

  const name = node.attributes.name || "";
  if (name === "identifier" || name === "traits.email") return "Email";
  if (name === "password") return "Password";
  if (name === "code") return "Verification Code";
  if (name === "totp_code") return "Authenticator Code";

  const normalized = (name.includes(".") ? name.split(".").pop() || name : name)
    .replace(/[_-]/g, " ")
    .trim();

  if (!normalized) return "Field";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getFieldAutoComplete(
  name: string,
  type?: string,
  actionUrl?: string
): string {
  const normalizedAction = (actionUrl || "").toLowerCase();

  if (name === "identifier" || name === "traits.email") return "email";
  if (name === "totp_code" || name.endsWith("code")) return "one-time-code";

  if (name === "password") {
    if (
      normalizedAction.includes("/registration") ||
      normalizedAction.includes("/settings")
    ) {
      return "new-password";
    }

    return "current-password";
  }

  if (name.includes("password") && name !== "password") {
    return "new-password";
  }

  if (type === "tel") return "tel";

  if (name === "traits.name.first") return "given-name";
  if (name === "traits.name.last") return "family-name";
  return "off";
}

