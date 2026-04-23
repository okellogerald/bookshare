import type { KratosBrowserFlow, KratosUiMessage, KratosUiNode } from "@/shared/lib/kratos";
import {
  findSubmitNode,
  findVisibleFieldNode,
  getOptionalSingleNode,
  getResolvedNodeValue,
  isFieldNode,
  normalizeGroup,
  resolveHiddenFields,
} from "@/shared/lib/kratos-ui";

type LoginFieldKey = "identifier" | "password";
type LoginFieldType = "email" | "password";

interface LoginFieldDefinition<TKey extends LoginFieldKey = LoginFieldKey> {
  /** Stable UI key used by the login feature. */
  key: TKey;
  /** Kratos node name that supplies this field's value. */
  name: string;
  /** User-facing label rendered by the BookShare login form. */
  label: string;
  /** Input widget type the UI should render. */
  type: LoginFieldType;
}

const LOGIN_IDENTIFIER_FIELD: LoginFieldDefinition<"identifier"> = {
  key: "identifier",
  name: "identifier",
  label: "Email",
  type: "email",
};

const LOGIN_PASSWORD_FIELD: LoginFieldDefinition<"password"> = {
  key: "password",
  name: "password",
  label: "Password",
  type: "password",
};

function toSubmitModel(node: KratosUiNode): LoginSubmitModel {
  return {
    name: node.attributes.name,
    value: node.attributes.value,
    label: node.meta?.label?.text?.trim() || "Sign in",
    group: normalizeGroup(node.group),
  };
}

function toFieldModel(
  flow: KratosBrowserFlow,
  node: KratosUiNode,
  definition: LoginFieldDefinition
): LoginFieldModel {
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
  definition: LoginFieldDefinition
): LoginFieldModel {
  return toFieldModel(
    flow,
    findVisibleFieldNode(
      flow,
      definition.name,
      `Login flow expected exactly one visible '${definition.name}' node.`
    ),
    definition
  );
}

function resolveIdentifierField(flow: KratosBrowserFlow): LoginFieldModel {
  const visibleNode = getOptionalSingleNode(
    flow.ui.nodes,
    (node) => isFieldNode(node, LOGIN_IDENTIFIER_FIELD.name) && node.attributes.type !== "hidden",
    "Login flow expected at most one visible 'identifier' node."
  );

  if (visibleNode) {
    return toFieldModel(flow, visibleNode, LOGIN_IDENTIFIER_FIELD);
  }

  const hiddenNode = getOptionalSingleNode(
    flow.ui.nodes,
    (node) => isFieldNode(node, LOGIN_IDENTIFIER_FIELD.name) && node.attributes.type === "hidden",
    "Login flow expected at most one hidden 'identifier' node."
  );

  if (hiddenNode && flow.refresh) {
    return {
      ...toFieldModel(flow, hiddenNode, LOGIN_IDENTIFIER_FIELD),
      disabled: true,
    };
  }

  throw new Error(
    "Login flow expected one visible 'identifier' node, or one hidden 'identifier' node for a refresh login flow."
  );
}

/**
 * Hidden Kratos inputs that must be posted back unchanged on the next login
 * submission.
 */
export interface LoginHiddenField {
  /** Hidden input name expected by Kratos. */
  name: string;
  /** Hidden input value resolved from the current flow. */
  value: string;
  /** Kratos group that originally owned the hidden node. */
  group: string;
}

/**
 * Normalized field data for a single login input.
 */
export interface LoginFieldModel {
  /** Stable field identifier used by the login feature. */
  key: LoginFieldKey;
  /** Kratos field name submitted with the login form. */
  name: string;
  /** User-facing label shown next to the input. */
  label: string;
  /** Input widget type the UI should render. */
  type: LoginFieldType;
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
 * Normalized submit button metadata for the login action.
 */
export interface LoginSubmitModel {
  /** Submit field name Kratos expects on login submission. */
  name?: string;
  /** Submit field value Kratos expects on login submission. */
  value?: string;
  /** Button label rendered in the BookShare login form. */
  label: string;
  /** Kratos group the submit node belongs to. */
  group: string;
}

/**
 * Links rendered in the login page footer.
 */
interface LoginPageLinks {
  /** Link into the registration flow. */
  registerHref: string;
  /** Link into the recovery flow. */
  recoveryHref: string;
  /** Link that discards the current login flow and starts over. */
  retryHref: string;
}

/**
 * Successful login page model used by the dedicated login form.
 */
export interface LoginStepModel extends LoginPageLinks {
  /** Discriminator for the normal login page. */
  variant: "login";
  /** Kratos flow identifier for the current login flow. */
  flowId: string;
  /** Kratos form action URL for login submission. */
  action: string;
  /** HTTP method Kratos expects for the login form. */
  method: string;
  /** Flow-level messages returned by Kratos. */
  messages: KratosUiMessage[];
  /** Hidden inputs that preserve Kratos flow state across submissions. */
  hiddenFields: LoginHiddenField[];
  /** Email/identifier field rendered by the login form. */
  identifierField: LoginFieldModel;
  /** Password field rendered by the login form. */
  passwordField: LoginFieldModel;
  /** Primary submit action that completes login. */
  submit: LoginSubmitModel;
}

/**
 * Recoverable page model used when the login flow cannot be mapped into the
 * supported BookShare email-and-password shape.
 */
export interface LoginErrorPageModel extends LoginPageLinks {
  /** Discriminator for the recoverable login error page. */
  variant: "error";
  /** Page title shown when login cannot continue. */
  title: string;
  /** User-facing explanation of the failure state. */
  description: string;
  /** Lower-level detail that explains the mapping failure. */
  detail?: string;
}

/**
 * Union of all login page states the route can render.
 */
export type LoginPageModel = LoginStepModel | LoginErrorPageModel;

/**
 * Converts the raw Kratos login flow into the explicit BookShare login model.
 *
 * The function is necessary because the product supports exactly one login
 * shape: email plus password. The mapper fails loudly if the Kratos flow
 * diverges from that contract.
 */
export function buildLoginModel(
  flow: KratosBrowserFlow,
  links: LoginPageLinks
): LoginStepModel {
  const submit = findSubmitNode(
    flow,
    { group: "password", name: "method", value: "password" },
    "Login flow expected exactly one password submit node."
  );

  return {
    variant: "login",
    flowId: flow.id,
    action: flow.ui.action,
    method: flow.ui.method.toLowerCase(),
    messages: flow.ui.messages ?? [],
    hiddenFields: resolveHiddenFields(flow) as LoginHiddenField[],
    identifierField: resolveIdentifierField(flow),
    passwordField: resolveField(flow, LOGIN_PASSWORD_FIELD),
    submit: toSubmitModel(submit),
    registerHref: links.registerHref,
    recoveryHref: links.recoveryHref,
    retryHref: links.retryHref,
  };
}
