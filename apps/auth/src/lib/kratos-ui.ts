import type { KratosBrowserFlow, KratosUiNode } from "./kratos";

export type KratosUiNodeLike = KratosUiNode;

export interface KratosSubmitNodeOptions {
  group?: string;
  name?: string;
  value?: string;
}

export interface KratosHiddenField {
  name: string;
  value: string;
  group: string;
}

/**
 * Returns the most appropriate human-readable label for a Kratos UI node.
 *
 * Kratos may omit explicit labels for some fields, so the UI falls back to a
 * stable label derived from the node name.
 */
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

/**
 * Chooses a browser autocomplete hint for a Kratos field.
 *
 * The mapping stays in one place so flow renderers do not each invent their
 * own autocomplete rules.
 */
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

/**
 * Normalizes Kratos node groups so blank values are treated as the implicit
 * `default` group.
 */
export function normalizeGroup(group?: string): string {
  return group?.trim() || "default";
}

/**
 * Returns true when the Kratos node is a hidden input that must be preserved
 * across form submissions.
 */
export function isHiddenNode(node: KratosUiNodeLike): boolean {
  return node.type === "input" && node.attributes.type === "hidden";
}

/**
 * Returns true when the Kratos node is a submit-style control.
 */
export function isSubmitNode(node: KratosUiNodeLike): boolean {
  return (
    node.type === "input" &&
    (node.attributes.type === "submit" || node.attributes.type === "button")
  );
}

/**
 * Returns true when the node is a named Kratos field and not a submit control.
 */
export function isFieldNode(
  node: KratosUiNodeLike,
  fieldName: string
): boolean {
  return node.type === "input" && node.attributes.name === fieldName && !isSubmitNode(node);
}

/**
 * Returns true when the node is a named field that should be rendered to the
 * user instead of carried as a hidden input.
 */
export function isVisibleFieldNode(
  node: KratosUiNodeLike,
  fieldName: string
): boolean {
  return isFieldNode(node, fieldName) && !isHiddenNode(node);
}

/**
 * Reads a trait value from `flow.identity.traits` using the Kratos field name.
 *
 * This is mainly used when Kratos carries a trait through hidden nodes without
 * repeating the value in the node attributes.
 */
export function getTraitValue(
  flow: Pick<KratosBrowserFlow, "identity">,
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

/**
 * Resolves the effective node value by preferring the explicit node value and
 * falling back to the matching identity trait when Kratos omits it.
 */
export function getResolvedNodeValue(
  flow: Pick<KratosBrowserFlow, "identity">,
  node: KratosUiNodeLike
): string {
  if (typeof node.attributes.value === "string") {
    return node.attributes.value;
  }

  return getTraitValue(flow, node.attributes.name ?? "") ?? "";
}

/**
 * Returns exactly one matching node or throws when the flow shape differs from
 * what the caller expects.
 */
export function getSingleNode<TNode extends KratosUiNodeLike>(
  nodes: readonly TNode[],
  predicate: (node: TNode) => boolean,
  errorMessage: string
): TNode {
  const matches = nodes.filter(predicate);

  if (matches.length !== 1) {
    throw new Error(`${errorMessage} Received ${matches.length}.`);
  }

  return matches[0];
}

/**
 * Returns one matching node or `null`, and still throws when multiple matches
 * exist because that indicates an unexpected Kratos flow shape.
 */
export function getOptionalSingleNode<TNode extends KratosUiNodeLike>(
  nodes: readonly TNode[],
  predicate: (node: TNode) => boolean,
  errorMessage: string
): TNode | null {
  const matches = nodes.filter(predicate);

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    throw new Error(`${errorMessage} Received ${matches.length}.`);
  }

  return matches[0];
}

/**
 * Finds a visible field node by Kratos field name and enforces that it exists
 * exactly once.
 */
export function findVisibleFieldNode(
  flow: Pick<KratosBrowserFlow, "ui">,
  fieldName: string,
  errorMessage: string
): KratosUiNode {
  return getSingleNode(
    flow.ui.nodes,
    (node) => isVisibleFieldNode(node, fieldName),
    errorMessage
  );
}

/**
 * Finds a visible field node by Kratos field name when the field may or may
 * not be present in the current step.
 */
export function findOptionalVisibleFieldNode(
  flow: Pick<KratosBrowserFlow, "ui">,
  fieldName: string,
  errorMessage: string
): KratosUiNode | null {
  return getOptionalSingleNode(
    flow.ui.nodes,
    (node) => isVisibleFieldNode(node, fieldName),
    errorMessage
  );
}

/**
 * Finds the submit node that matches the requested Kratos group/name/value
 * combination and enforces that it exists exactly once.
 */
export function findSubmitNode(
  flow: Pick<KratosBrowserFlow, "ui">,
  options: KratosSubmitNodeOptions,
  errorMessage: string
): KratosUiNode {
  return getSingleNode(
    flow.ui.nodes,
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

/**
 * Finds the submit node that matches the requested Kratos group/name/value
 * combination when that control may be optional for the current flow step.
 */
export function findOptionalSubmitNode(
  flow: Pick<KratosBrowserFlow, "ui">,
  options: KratosSubmitNodeOptions,
  errorMessage: string
): KratosUiNode | null {
  return getOptionalSingleNode(
    flow.ui.nodes,
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

/**
 * Removes duplicate hidden nodes while preserving the original order.
 *
 * Kratos can repeat hidden nodes across default and non-default groups, but
 * the rendered form only needs one copy of each name/value pair.
 */
export function dedupeHiddenNodes<TNode extends KratosUiNodeLike>(
  nodes: readonly TNode[]
): TNode[] {
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

/**
 * Converts the hidden nodes in a Kratos flow into serializable hidden field
 * values that can be passed back unchanged on the next submission.
 */
export function resolveHiddenFields(
  flow: Pick<KratosBrowserFlow, "identity" | "ui">
): KratosHiddenField[] {
  return dedupeHiddenNodes(flow.ui.nodes.filter(isHiddenNode)).map((node) => ({
    name: node.attributes.name ?? "",
    value: getResolvedNodeValue(flow, node),
    group: normalizeGroup(node.group),
  }));
}
