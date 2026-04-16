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

// Registration is modeled as explicit product-owned steps instead of a generic
// "render whatever Kratos returned" approach. This keeps each step isolated and
// makes step-specific maintenance straightforward.
/**
 * Registration fields that are shared across both steps of the BookShare
 * registration flow.
 */
type RegistrationCommonFieldKey =
  | "firstName"
  | "lastName"
  | "gender"
  | "email";

/**
 * All field keys that can appear in the registration UI, including the
 * password-only step.
 */
type RegistrationFieldKey = RegistrationCommonFieldKey | "password";

/**
 * Supported input kinds for the registration-owned view model.
 */
type RegistrationFieldType = "text" | "email" | "password" | "select";

/**
 * Static metadata that maps a BookShare registration field to the Kratos node
 * name that should supply its value.
 */
interface RegistrationFieldDefinition<TKey extends RegistrationFieldKey = RegistrationFieldKey> {
  /** Stable UI key used by the registration feature. */
  key: TKey;
  /** Kratos node name that supplies this field's value. */
  name: string;
  /** Product label shown for this field in the registration UI. */
  label: string;
  /** Input type the registration form should render for this field. */
  type: RegistrationFieldType;
}

const REGISTRATION_FIELDS: readonly RegistrationFieldDefinition<RegistrationCommonFieldKey>[] = [
  {
    key: "email",
    name: "traits.email",
    label: "Email",
    type: "email",
  },
  {
    key: "firstName",
    name: "traits.name.first",
    label: "First name",
    type: "text",
  },
  {
    key: "lastName",
    name: "traits.name.last",
    label: "Last name",
    type: "text",
  },
  {
    key: "gender",
    name: "traits.gender",
    label: "Gender",
    type: "select",
  },
] as const;

const REGISTRATION_PASSWORD_FIELD: RegistrationFieldDefinition<"password"> = {
  key: "password",
  name: "password",
  label: "Password",
  type: "password",
};

function toSubmitModel(node: KratosUiNode): RegistrationSubmitModel {
  return {
    name: node.attributes.name,
    value: node.attributes.value,
    label:
      node.meta?.label?.text?.trim() ||
      node.attributes.value ||
      "Continue",
    group: normalizeGroup(node.group),
  };
}

function toFieldModel(
  flow: KratosBrowserFlow,
  node: KratosUiNode,
  definition: RegistrationFieldDefinition
): RegistrationFieldModel {
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

function resolveVisibleField(
  flow: KratosBrowserFlow,
  definition: RegistrationFieldDefinition
): RegistrationFieldModel {
  return toFieldModel(
    flow,
    findVisibleFieldNode(
      flow,
      definition.name,
      `Registration step expected exactly one visible '${definition.name}' node.`
    ),
    definition
  );
}

function resolveCommonVisibleFields(
  flow: KratosBrowserFlow
): Record<RegistrationCommonFieldKey, RegistrationFieldModel> {
  return Object.fromEntries(
    REGISTRATION_FIELDS.map((definition) => [
      definition.key,
      resolveVisibleField(flow, definition),
    ])
  ) as Record<RegistrationCommonFieldKey, RegistrationFieldModel>;
}

export interface RegistrationHiddenField {
  /** Hidden input name that must be posted back to Kratos unchanged. */
  name: string;
  /** Hidden input value resolved from the Kratos node or identity trait. */
  value: string;
  /** Kratos group that originally owned this hidden field. */
  group: string;
}

/**
 * Normalized field data for a single registration input.
 *
 * The mapper converts raw Kratos nodes into this shape so the registration UI
 * can render explicit form controls without depending on generic node parsing.
 */
export interface RegistrationFieldModel {
  /** Stable field identifier used by the registration feature. */
  key: RegistrationFieldKey;
  /** Kratos field name submitted with the form. */
  name: string;
  /** User-facing label shown next to the input. */
  label: string;
  /** Input widget type the UI should render. */
  type: RegistrationFieldType;
  /** Current field value resolved from the flow. */
  value: string;
  /** Whether Kratos marks this field as required. */
  required: boolean;
  /** Whether Kratos marks this field as non-editable. */
  disabled: boolean;
  /** Kratos group the node belongs to in the raw flow. */
  group: string;
  /** Field-specific validation or informational messages from Kratos. */
  messages: KratosUiMessage[];
}

/**
 * Normalized submit control metadata for a registration step action.
 */
export interface RegistrationSubmitModel {
  /** Submit field name Kratos expects on form submission. */
  name?: string;
  /** Submit field value Kratos expects on form submission. */
  value?: string;
  /** Button label rendered in the BookShare UI. */
  label: string;
  /** Kratos group the submit node belongs to. */
  group: string;
}

/**
 * Links that are shared by every registration page variant.
 */
interface RegistrationPageLinks {
  /** Link back into the sign-in flow. */
  loginHref: string;
  /** Link into the recovery flow for existing accounts. */
  recoveryHref: string;
  /** Link that discards the current flow and starts registration again. */
  resetHref: string;
}

/**
 * Properties shared by every successful registration step model.
 */
interface RegistrationStepModelBase extends RegistrationPageLinks {
  /** Kratos flow identifier for the current registration flow. */
  flowId: string;
  /** Kratos form action URL for the current step submission. */
  action: string;
  /** HTTP method Kratos expects for the current form. */
  method: string;
  /** Flow-level messages Kratos returned for this registration step. */
  messages: KratosUiMessage[];
  /** Hidden inputs that preserve the Kratos flow state across submissions. */
  hiddenFields: RegistrationHiddenField[];
}

/**
 * View model for the first registration step where profile traits are entered.
 */
export interface RegistrationProfileStepModel extends RegistrationStepModelBase {
  /** Discriminator for the profile-entry step. */
  variant: "profile";
  /** Human-readable step number used by the UI. */
  stepNumber: 1;
  /** Total number of registration steps in the product flow. */
  totalSteps: 2;
  /** Visible profile fields rendered on the first step. */
  fields: Record<RegistrationCommonFieldKey, RegistrationFieldModel>;
  /** Primary action that advances the flow to the password step. */
  submit: RegistrationSubmitModel;
}

/**
 * View model for the second registration step where the password is chosen.
 */
export interface RegistrationPasswordStepModel extends RegistrationStepModelBase {
  /** Discriminator for the password step. */
  variant: "password";
  /** Human-readable step number used by the UI. */
  stepNumber: 2;
  /** Total number of registration steps in the product flow. */
  totalSteps: 2;
  /** Visible password field rendered on the second step. */
  passwordField: RegistrationFieldModel;
  /** Primary action that completes registration. */
  submit: RegistrationSubmitModel;
  /** Optional Kratos action that moves the flow back to the profile step. */
  previousStepSubmit: RegistrationSubmitModel | null;
}

/**
 * Recoverable page model used when the registration flow cannot be mapped into
 * a supported BookShare step.
 */
export interface RegistrationErrorPageModel extends RegistrationPageLinks {
  /** Discriminator for the recoverable error page. */
  variant: "error";
  /** Page title shown when registration cannot continue. */
  title: string;
  /** User-facing explanation of the failure state. */
  description: string;
  /** Lower-level detail that helps explain the specific mapping failure. */
  detail?: string;
}

/**
 * Recoverable page model used when registration detects that the user is
 * trying to sign up with an email address that already belongs to an account.
 *
 * Registration should not continue in this case. The auth box should steer the
 * user into sign-in or password recovery instead, and the normal login flow can
 * then decide whether verification is still required.
 */
export interface RegistrationExistingAccountPageModel extends RegistrationPageLinks {
  /** Discriminator for the existing-account guidance page. */
  variant: "existing-account";
  /** Optional email value resolved from the current flow. */
  email?: string;
}

/**
 * Union of all registration page states the route can render.
 */
export type RegistrationPageModel =
  | RegistrationProfileStepModel
  | RegistrationPasswordStepModel
  | RegistrationExistingAccountPageModel
  | RegistrationErrorPageModel;

function findFieldValue(flow: KratosBrowserFlow, name: string): string {
  const node = flow.ui.nodes.find((candidate) => candidate.attributes.name === name);
  if (!node) {
    return "";
  }

  return getResolvedNodeValue(flow, node).trim();
}

function collectRegistrationMessages(flow: KratosBrowserFlow): KratosUiMessage[] {
  return [
    ...(flow.ui.messages ?? []),
    ...flow.ui.nodes.flatMap((node) => node.messages ?? []),
  ];
}

function findExistingAccountHint(
  messages: KratosUiMessage[]
): KratosUiMessage | null {
  const existingAccountPattern =
    /(already exists|existing account|already have an account|sign in to your existing account)/i;

  return (
    messages.find(
      (message) =>
        message.type === "error" && existingAccountPattern.test(message.text)
    ) ?? null
  );
}

function buildProfileStepModel(
  flow: KratosBrowserFlow,
  loginHref: string,
  recoveryHref: string,
  resetHref: string
): RegistrationProfileStepModel {
  const submit = findSubmitNode(
    flow,
    { group: "profile", name: "method", value: "profile" },
    "Registration profile step expected exactly one profile submit node."
  );

  return {
    variant: "profile",
    stepNumber: 1,
    totalSteps: 2,
    flowId: flow.id,
    action: flow.ui.action,
    method: flow.ui.method.toLowerCase(),
    messages: flow.ui.messages ?? [],
    hiddenFields: resolveHiddenFields(flow),
    fields: resolveCommonVisibleFields(flow),
    submit: toSubmitModel(submit),
    loginHref,
    recoveryHref,
    resetHref,
  };
}

function buildPasswordStepModel(
  flow: KratosBrowserFlow,
  loginHref: string,
  recoveryHref: string,
  resetHref: string
): RegistrationPasswordStepModel {
  const passwordNode = findVisibleFieldNode(
    flow,
    REGISTRATION_PASSWORD_FIELD.name,
    "Registration password step expected exactly one visible 'password' node."
  );
  const submit = findSubmitNode(
    flow,
    { group: "password", name: "method", value: "password" },
    "Registration password step expected exactly one password submit node."
  );
  const previousStepSubmit = findOptionalSubmitNode(
    flow,
    { name: "screen", value: "previous" },
    "Registration password step expected at most one previous-step submit node."
  );

  return {
    variant: "password",
    stepNumber: 2,
    totalSteps: 2,
    flowId: flow.id,
    action: flow.ui.action,
    method: flow.ui.method.toLowerCase(),
    messages: flow.ui.messages ?? [],
    hiddenFields: resolveHiddenFields(flow),
    passwordField: toFieldModel(flow, passwordNode, REGISTRATION_PASSWORD_FIELD),
    submit: toSubmitModel(submit),
    previousStepSubmit: previousStepSubmit ? toSubmitModel(previousStepSubmit) : null,
    loginHref,
    recoveryHref,
    resetHref,
  };
}

/**
 * Converts the raw Kratos registration flow into one of the explicit BookShare
 * registration steps.
 *
 * The function is necessary because Kratos exposes generic nodes while the UI
 * needs two independently maintained forms:
 * 1. a profile step
 * 2. a password step
 */
export function buildRegistrationModel(
  flow: KratosBrowserFlow,
  loginHref: string,
  recoveryHref: string,
  resetHref: string
) : RegistrationPageModel {
  const existingAccountHint = findExistingAccountHint(
    collectRegistrationMessages(flow)
  );
  if (existingAccountHint) {
    const email = findFieldValue(flow, "traits.email");

    return {
      variant: "existing-account",
      email: email || undefined,
      loginHref,
      recoveryHref,
      resetHref,
    };
  }

  const passwordField = findOptionalVisibleFieldNode(
    flow,
    REGISTRATION_PASSWORD_FIELD.name,
    "Registration step expected at most one visible 'password' node."
  );

  if (passwordField) {
    return buildPasswordStepModel(flow, loginHref, recoveryHref, resetHref);
  }

  return buildProfileStepModel(flow, loginHref, recoveryHref, resetHref);
}
