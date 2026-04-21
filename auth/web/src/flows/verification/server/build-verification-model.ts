import type {
  KratosBrowserFlow,
  KratosUiMessage,
  KratosUiNode,
} from "@/shared/lib/kratos";
import {
  findOptionalSubmitNode,
  findOptionalVisibleFieldNode,
  findSubmitNode,
  findVisibleFieldNode,
  getResolvedNodeValue,
  normalizeGroup,
  resolveHiddenFields,
} from "@/shared/lib/kratos-ui";

type VerificationFieldKey = "email" | "code";
type VerificationFieldType = "email" | "text";

interface VerificationFieldDefinition<TKey extends VerificationFieldKey = VerificationFieldKey> {
  /** Stable UI key used by the verification feature. */
  key: TKey;
  /** Kratos field name that supplies this field's value. */
  name: string;
  /** User-facing label rendered by the verification form. */
  label: string;
  /** Input widget type the verification UI should render. */
  type: VerificationFieldType;
}

const VERIFICATION_EMAIL_FIELD: VerificationFieldDefinition<"email"> = {
  key: "email",
  name: "email",
  label: "Email",
  type: "email",
};

const VERIFICATION_CODE_FIELD: VerificationFieldDefinition<"code"> = {
  key: "code",
  name: "code",
  label: "Verification code",
  type: "text",
};

function toSubmitModel(
  node: KratosUiNode,
  fallbackLabel: string
): VerificationSubmitModel {
  return {
    name: node.attributes.name,
    value: node.attributes.value,
    label: node.meta?.label?.text?.trim() || fallbackLabel,
    group: normalizeGroup(node.group),
  };
}

function toFieldModel(
  flow: KratosBrowserFlow,
  node: KratosUiNode,
  definition: VerificationFieldDefinition
): VerificationFieldModel {
  return {
    key: definition.key,
    name: definition.name,
    label: definition.label,
    type: definition.type,
    value: getResolvedNodeValue(flow, node),
    required: Boolean(node.attributes.required),
    disabled: Boolean(node.attributes.disabled),
    group: normalizeGroup(node.group),
    messages: node.messages ?? [],
  };
}

function resolveField(
  flow: KratosBrowserFlow,
  definition: VerificationFieldDefinition
): VerificationFieldModel {
  return toFieldModel(
    flow,
    findVisibleFieldNode(
      flow,
      definition.name,
      `Verification flow expected exactly one visible '${definition.name}' node.`
    ),
    definition
  );
}

interface VerificationPageLinks {
  /** Link back into the sign-in flow. */
  loginHref: string;
  /** Link that discards the current verification flow and starts over. */
  retryHref: string;
}

/**
 * Hidden Kratos inputs that must be posted back unchanged on the next
 * verification submission.
 */
export interface VerificationHiddenField {
  /** Hidden input name expected by Kratos. */
  name: string;
  /** Hidden input value resolved from the current flow. */
  value: string;
  /** Kratos group that originally owned the hidden node. */
  group: string;
}

/**
 * Normalized field data for a single verification input.
 */
export interface VerificationFieldModel {
  /** Stable field identifier used by the verification feature. */
  key: VerificationFieldKey;
  /** Kratos field name submitted with the verification form. */
  name: string;
  /** User-facing label shown next to the input. */
  label: string;
  /** Input widget type the UI should render. */
  type: VerificationFieldType;
  /** Current value resolved from the flow. */
  value: string;
  /** Whether Kratos marks this field as required. */
  required: boolean;
  /** Whether Kratos marks this field as non-editable. */
  disabled: boolean;
  /** Kratos group the raw node belongs to. */
  group: string;
  /** Field-specific validation or informational messages from Kratos. */
  messages: KratosUiMessage[];
}

/**
 * Normalized submit button metadata for verification actions.
 */
export interface VerificationSubmitModel {
  /** Submit field name Kratos expects on verification submission. */
  name?: string;
  /** Submit field value Kratos expects on verification submission. */
  value?: string;
  /** Button label rendered in the BookShare verification form. */
  label: string;
  /** Kratos group the submit node belongs to. */
  group: string;
}

/**
 * First verification step where the user provides the email address to send a
 * code to.
 */
export interface VerificationEmailStepModel extends VerificationPageLinks {
  /** Discriminator for the verification email step. */
  variant: "email";
  /** Kratos flow identifier for the current verification flow. */
  flowId: string;
  /** Kratos form action URL for verification submission. */
  action: string;
  /** HTTP method Kratos expects for the verification form. */
  method: string;
  /** Flow-level messages returned by Kratos. */
  messages: KratosUiMessage[];
  /** Hidden inputs that preserve Kratos flow state across submissions. */
  hiddenFields: VerificationHiddenField[];
  /** Email field rendered by the verification form. */
  emailField: VerificationFieldModel;
  /** Primary submit action that sends the verification code. */
  submit: VerificationSubmitModel;
}

/**
 * Second verification step where the user enters the code they received.
 */
export interface VerificationCodeStepModel extends VerificationPageLinks {
  /** Discriminator for the verification code step. */
  variant: "code";
  /** Kratos flow identifier for the current verification flow. */
  flowId: string;
  /** Kratos form action URL for verification submission. */
  action: string;
  /** HTTP method Kratos expects for the verification form. */
  method: string;
  /** Flow-level messages returned by Kratos. */
  messages: KratosUiMessage[];
  /** Hidden inputs that preserve Kratos flow state across submissions. */
  hiddenFields: VerificationHiddenField[];
  /** Code field rendered by the verification form. */
  codeField: VerificationFieldModel;
  /** Primary submit action that validates the verification code. */
  submit: VerificationSubmitModel;
  /** Optional resend action exposed by Kratos. */
  resendSubmit: VerificationSubmitModel | null;
}

/**
 * Recoverable page model used when the verification flow cannot be mapped into
 * the supported BookShare email/code shape.
 */
export interface VerificationErrorPageModel extends VerificationPageLinks {
  /** Discriminator for the recoverable verification error page. */
  variant: "error";
  /** Page title shown when verification cannot continue. */
  title: string;
  /** User-facing explanation of the failure state. */
  description: string;
  /** Lower-level detail that explains the mapping failure. */
  detail?: string;
}

/**
 * Union of all verification page states the route can render.
 */
export type VerificationPageModel =
  | VerificationEmailStepModel
  | VerificationCodeStepModel
  | VerificationErrorPageModel;

/**
 * Converts the raw Kratos verification flow into the explicit BookShare
 * verification model.
 *
 * The function is necessary because the product supports exactly two
 * verification states:
 * 1. enter the email address to send a code
 * 2. enter the verification code that was sent
 */
export function buildVerificationModel(
  flow: KratosBrowserFlow,
  links: VerificationPageLinks
): VerificationPageModel {
  const codeField = findOptionalVisibleFieldNode(
    flow,
    VERIFICATION_CODE_FIELD.name,
    "Verification flow expected at most one visible 'code' node."
  );

  if (codeField) {
    const submit = findSubmitNode(
      flow,
      { group: "code", name: "method", value: "code" },
      "Verification flow expected exactly one code submit node."
    );
    const resendSubmit = findOptionalSubmitNode(
      flow,
      { group: "code", name: "email" },
      "Verification flow expected at most one resend-email submit node."
    );

    return {
      variant: "code",
      flowId: flow.id,
      action: flow.ui.action,
      method: flow.ui.method.toLowerCase(),
      messages: flow.ui.messages ?? [],
      hiddenFields: resolveHiddenFields(flow) as VerificationHiddenField[],
      codeField: toFieldModel(flow, codeField, VERIFICATION_CODE_FIELD),
      submit: toSubmitModel(submit, "Verify code"),
      resendSubmit: resendSubmit ? toSubmitModel(resendSubmit, "Resend code") : null,
      loginHref: links.loginHref,
      retryHref: links.retryHref,
    };
  }

  const emailField = resolveField(flow, VERIFICATION_EMAIL_FIELD);
  const submit = findSubmitNode(
    flow,
    { group: "code", name: "method", value: "code" },
    "Verification flow expected exactly one email-step submit node."
  );

  return {
    variant: "email",
    flowId: flow.id,
    action: flow.ui.action,
    method: flow.ui.method.toLowerCase(),
    messages: flow.ui.messages ?? [],
    hiddenFields: resolveHiddenFields(flow) as VerificationHiddenField[],
    emailField,
    submit: toSubmitModel(submit, "Send code"),
    loginHref: links.loginHref,
    retryHref: links.retryHref,
  };
}
