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

type RecoveryFieldKey = "email" | "code";
type RecoveryFieldType = "email" | "text";

interface RecoveryFieldDefinition<TKey extends RecoveryFieldKey = RecoveryFieldKey> {
  /** Stable UI key used by the recovery feature. */
  key: TKey;
  /** Kratos field name that supplies this field's value. */
  name: string;
  /** User-facing label rendered by the recovery form. */
  label: string;
  /** Input widget type the UI should render. */
  type: RecoveryFieldType;
}

const RECOVERY_EMAIL_FIELD: RecoveryFieldDefinition<"email"> = {
  key: "email",
  name: "email",
  label: "Email",
  type: "email",
};

const RECOVERY_CODE_FIELD: RecoveryFieldDefinition<"code"> = {
  key: "code",
  name: "code",
  label: "Recovery code",
  type: "text",
};

function toSubmitModel(
  node: KratosUiNode,
  fallbackLabel: string
): RecoverySubmitModel {
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
  definition: RecoveryFieldDefinition
): RecoveryFieldModel {
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
  definition: RecoveryFieldDefinition
): RecoveryFieldModel {
  return toFieldModel(
    flow,
    findVisibleFieldNode(
      flow,
      definition.name,
      `Recovery flow expected exactly one visible '${definition.name}' node.`
    ),
    definition
  );
}

interface RecoveryPageLinks {
  /** Link back into the sign-in flow. */
  loginHref: string;
  /** Link that discards the current recovery flow and starts over. */
  retryHref: string;
}

/**
 * Hidden Kratos inputs that must be posted back unchanged on the next
 * recovery submission.
 */
export interface RecoveryHiddenField {
  /** Hidden input name expected by Kratos. */
  name: string;
  /** Hidden input value resolved from the current flow. */
  value: string;
  /** Kratos group that originally owned the hidden node. */
  group: string;
}

/**
 * Normalized field data for a single recovery input.
 */
export interface RecoveryFieldModel {
  /** Stable field identifier used by the recovery feature. */
  key: RecoveryFieldKey;
  /** Kratos field name submitted with the recovery form. */
  name: string;
  /** User-facing label shown next to the input. */
  label: string;
  /** Input widget type the UI should render. */
  type: RecoveryFieldType;
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
 * Normalized submit button metadata for recovery actions.
 */
export interface RecoverySubmitModel {
  /** Submit field name Kratos expects on recovery submission. */
  name?: string;
  /** Submit field value Kratos expects on recovery submission. */
  value?: string;
  /** Button label rendered in the BookShare recovery form. */
  label: string;
  /** Kratos group the submit node belongs to. */
  group: string;
}

/**
 * First recovery step where the user provides the email address to send a
 * recovery code to.
 */
export interface RecoveryEmailStepModel extends RecoveryPageLinks {
  /** Discriminator for the recovery email step. */
  variant: "email";
  /** Kratos flow identifier for the current recovery flow. */
  flowId: string;
  /** Kratos form action URL for recovery submission. */
  action: string;
  /** HTTP method Kratos expects for the recovery form. */
  method: string;
  /** Flow-level messages returned by Kratos. */
  messages: KratosUiMessage[];
  /** Hidden inputs that preserve Kratos flow state across submissions. */
  hiddenFields: RecoveryHiddenField[];
  /** Email field rendered by the recovery form. */
  emailField: RecoveryFieldModel;
  /** Primary submit action that sends the recovery code. */
  submit: RecoverySubmitModel;
}

/**
 * Second recovery step where the user enters the emailed recovery code.
 */
export interface RecoveryCodeStepModel extends RecoveryPageLinks {
  /** Discriminator for the recovery code step. */
  variant: "code";
  /** Kratos flow identifier for the current recovery flow. */
  flowId: string;
  /** Kratos form action URL for recovery submission. */
  action: string;
  /** HTTP method Kratos expects for the recovery form. */
  method: string;
  /** Flow-level messages returned by Kratos. */
  messages: KratosUiMessage[];
  /** Hidden inputs that preserve Kratos flow state across submissions. */
  hiddenFields: RecoveryHiddenField[];
  /** Code field rendered by the recovery form. */
  codeField: RecoveryFieldModel;
  /** Primary submit action that validates the recovery code. */
  submit: RecoverySubmitModel;
  /** Optional resend action exposed by Kratos. */
  resendSubmit: RecoverySubmitModel | null;
}

/**
 * Recoverable page model used when the recovery flow cannot be mapped into the
 * supported BookShare email/code shape.
 */
export interface RecoveryErrorPageModel extends RecoveryPageLinks {
  /** Discriminator for the recoverable recovery error page. */
  variant: "error";
  /** Page title shown when recovery cannot continue. */
  title: string;
  /** User-facing explanation of the failure state. */
  description: string;
  /** Lower-level detail that explains the mapping failure. */
  detail?: string;
}

/**
 * Union of all recovery page states the route can render.
 */
export type RecoveryPageModel =
  | RecoveryEmailStepModel
  | RecoveryCodeStepModel
  | RecoveryErrorPageModel;

/**
 * Converts the raw Kratos recovery flow into the explicit BookShare recovery
 * model.
 *
 * The function is necessary because the product supports exactly two recovery
 * states:
 * 1. enter the email address to request a recovery code
 * 2. enter the recovery code that was sent
 */
export function buildRecoveryModel(
  flow: KratosBrowserFlow,
  links: RecoveryPageLinks
): RecoveryPageModel {
  const codeField = findOptionalVisibleFieldNode(
    flow,
    RECOVERY_CODE_FIELD.name,
    "Recovery flow expected at most one visible 'code' node."
  );

  if (codeField) {
    const submit = findSubmitNode(
      flow,
      { group: "code", name: "method", value: "code" },
      "Recovery flow expected exactly one code submit node."
    );
    const resendSubmit = findOptionalSubmitNode(
      flow,
      { group: "code", name: "email" },
      "Recovery flow expected at most one resend-email submit node."
    );

    return {
      variant: "code",
      flowId: flow.id,
      action: flow.ui.action,
      method: flow.ui.method.toLowerCase(),
      messages: flow.ui.messages ?? [],
      hiddenFields: resolveHiddenFields(flow) as RecoveryHiddenField[],
      codeField: toFieldModel(flow, codeField, RECOVERY_CODE_FIELD),
      submit: toSubmitModel(submit, "Continue"),
      resendSubmit: resendSubmit ? toSubmitModel(resendSubmit, "Resend code") : null,
      loginHref: links.loginHref,
      retryHref: links.retryHref,
    };
  }

  const emailField = resolveField(flow, RECOVERY_EMAIL_FIELD);
  const submit = findSubmitNode(
    flow,
    { group: "code", name: "method", value: "code" },
    "Recovery flow expected exactly one email-step submit node."
  );

  return {
    variant: "email",
    flowId: flow.id,
    action: flow.ui.action,
    method: flow.ui.method.toLowerCase(),
    messages: flow.ui.messages ?? [],
    hiddenFields: resolveHiddenFields(flow) as RecoveryHiddenField[],
    emailField,
    submit: toSubmitModel(submit, "Send recovery code"),
    loginHref: links.loginHref,
    retryHref: links.retryHref,
  };
}
