import type {
  KratosBrowserFlow,
  KratosUiMessage,
  KratosUiNode,
} from "@/lib/kratos";

// Registration is modeled as explicit product-owned steps instead of a generic
// "render whatever Kratos returned" approach. This keeps each step isolated and
// makes step-specific maintenance straightforward.
type RegistrationCommonFieldKey =
  | "firstName"
  | "lastName"
  | "gender"
  | "email";

type RegistrationFieldKey = RegistrationCommonFieldKey | "password";

type RegistrationFieldType = "text" | "email" | "password" | "select";

interface RegistrationFieldDefinition<TKey extends RegistrationFieldKey = RegistrationFieldKey> {
  key: TKey;
  name: string;
  label: string;
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

function normalizeGroup(group?: string): string {
  return group?.trim() || "default";
}

function isHiddenNode(node: KratosUiNode): boolean {
  return node.type === "input" && node.attributes.type === "hidden";
}

function isSubmitNode(node: KratosUiNode): boolean {
  return (
    node.type === "input" &&
    (node.attributes.type === "submit" || node.attributes.type === "button")
  );
}

function isFieldNode(node: KratosUiNode, fieldName: string): boolean {
  return node.type === "input" && node.attributes.name === fieldName && !isSubmitNode(node);
}

function isVisibleFieldNode(node: KratosUiNode, fieldName: string): boolean {
  return isFieldNode(node, fieldName) && !isHiddenNode(node);
}

function getTraitValue(
  flow: KratosBrowserFlow,
  fieldName: string
): string | undefined {
  if (!fieldName.startsWith("traits.")) {
    return undefined;
  }

  const traitPath = fieldName.slice("traits.".length);
  if (!traitPath) {
    return undefined;
  }

  let current: unknown = flow.identity?.traits;

  for (const segment of traitPath.split(".").filter(Boolean)) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  if (typeof current === "string") {
    return current;
  }

  if (typeof current === "number" || typeof current === "boolean") {
    return String(current);
  }

  return undefined;
}

function getResolvedNodeValue(flow: KratosBrowserFlow, node: KratosUiNode): string {
  if (typeof node.attributes.value === "string") {
    return node.attributes.value;
  }

  return getTraitValue(flow, node.attributes.name ?? "") ?? "";
}

function getSingleNode(
  flow: KratosBrowserFlow,
  predicate: (node: KratosUiNode) => boolean,
  errorMessage: string
): KratosUiNode {
  const matches = flow.ui.nodes.filter(predicate);

  if (matches.length !== 1) {
    throw new Error(`${errorMessage} Received ${matches.length}.`);
  }

  return matches[0];
}

function getOptionalSingleNode(
  flow: KratosBrowserFlow,
  predicate: (node: KratosUiNode) => boolean,
  errorMessage: string
): KratosUiNode | null {
  const matches = flow.ui.nodes.filter(predicate);

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    throw new Error(`${errorMessage} Received ${matches.length}.`);
  }

  return matches[0];
}

function findVisibleFieldNode(
  flow: KratosBrowserFlow,
  definition: RegistrationFieldDefinition
): KratosUiNode {
  return getSingleNode(
    flow,
    (node) => isVisibleFieldNode(node, definition.name),
    `Registration step expected exactly one visible '${definition.name}' node.`
  );
}

function findOptionalVisibleFieldNode(
  flow: KratosBrowserFlow,
  definition: RegistrationFieldDefinition
): KratosUiNode | null {
  return getOptionalSingleNode(
    flow,
    (node) => isVisibleFieldNode(node, definition.name),
    `Registration step expected at most one visible '${definition.name}' node.`
  );
}

function findSubmitNode(
  flow: KratosBrowserFlow,
  options: {
    group?: string;
    name?: string;
    value?: string;
  },
  errorMessage: string
): KratosUiNode {
  return getSingleNode(
    flow,
    (node) => {
      if (!isSubmitNode(node)) return false;
      if (options.group && normalizeGroup(node.group) !== options.group) return false;
      if (options.name && node.attributes.name !== options.name) return false;
      if (options.value && node.attributes.value !== options.value) return false;
      return true;
    },
    errorMessage
  );
}

function findOptionalSubmitNode(
  flow: KratosBrowserFlow,
  options: {
    group?: string;
    name?: string;
    value?: string;
  },
  errorMessage: string
): KratosUiNode | null {
  return getOptionalSingleNode(
    flow,
    (node) => {
      if (!isSubmitNode(node)) return false;
      if (options.group && normalizeGroup(node.group) !== options.group) return false;
      if (options.name && node.attributes.name !== options.name) return false;
      if (options.value && node.attributes.value !== options.value) return false;
      return true;
    },
    errorMessage
  );
}

function dedupeHiddenNodes(nodes: KratosUiNode[]): KratosUiNode[] {
  const seen = new Set<string>();

  return nodes.filter((node) => {
    const key = `${node.attributes.name ?? ""}:${node.attributes.value ?? ""}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

// Hidden fields carry Kratos flow state across steps. The UI must preserve them
// exactly or the next step submission will fail.
function resolveHiddenFields(flow: KratosBrowserFlow): RegistrationHiddenField[] {
  return dedupeHiddenNodes(flow.ui.nodes.filter(isHiddenNode)).map((node) => ({
    name: node.attributes.name ?? "",
    value: getResolvedNodeValue(flow, node),
    group: normalizeGroup(node.group),
  }));
}

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
  return toFieldModel(flow, findVisibleFieldNode(flow, definition), definition);
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
  name: string;
  value: string;
  group: string;
}

export interface RegistrationFieldModel {
  key: RegistrationFieldKey;
  name: string;
  label: string;
  type: RegistrationFieldType;
  value: string;
  required: boolean;
  disabled: boolean;
  group: string;
  messages: KratosUiMessage[];
}

export interface RegistrationSubmitModel {
  name?: string;
  value?: string;
  label: string;
  group: string;
}

interface RegistrationPageLinks {
  loginHref: string;
  resetHref: string;
}

interface RegistrationStepModelBase extends RegistrationPageLinks {
  flowId: string;
  action: string;
  method: string;
  messages: KratosUiMessage[];
  hiddenFields: RegistrationHiddenField[];
}

export interface RegistrationProfileStepModel extends RegistrationStepModelBase {
  variant: "profile";
  stepNumber: 1;
  totalSteps: 2;
  fields: Record<RegistrationCommonFieldKey, RegistrationFieldModel>;
  submit: RegistrationSubmitModel;
}

export interface RegistrationPasswordStepModel extends RegistrationStepModelBase {
  variant: "password";
  stepNumber: 2;
  totalSteps: 2;
  passwordField: RegistrationFieldModel;
  submit: RegistrationSubmitModel;
  previousStepSubmit: RegistrationSubmitModel | null;
}

export interface RegistrationErrorPageModel extends RegistrationPageLinks {
  variant: "error";
  title: string;
  description: string;
  detail?: string;
}

export type RegistrationPageModel =
  | RegistrationProfileStepModel
  | RegistrationPasswordStepModel
  | RegistrationErrorPageModel;

function buildProfileStepModel(
  flow: KratosBrowserFlow,
  loginHref: string,
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
    resetHref,
  };
}

function buildPasswordStepModel(
  flow: KratosBrowserFlow,
  loginHref: string,
  resetHref: string
): RegistrationPasswordStepModel {
  const passwordNode = findVisibleFieldNode(flow, REGISTRATION_PASSWORD_FIELD);
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
  resetHref: string
): RegistrationProfileStepModel | RegistrationPasswordStepModel {
  const passwordField = findOptionalVisibleFieldNode(flow, REGISTRATION_PASSWORD_FIELD);

  if (passwordField) {
    return buildPasswordStepModel(flow, loginHref, resetHref);
  }

  return buildProfileStepModel(flow, loginHref, resetHref);
}
