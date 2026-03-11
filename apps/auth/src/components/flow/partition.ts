import type { KratosBrowserFlow, KratosUiNode } from "@/lib/kratos";
import type { NodeSection } from "./types";

function isHiddenNode(node: KratosUiNode): boolean {
  return node.type === "input" && node.attributes.type === "hidden";
}

function isSubmitNode(node: KratosUiNode): boolean {
  return (
    node.type === "input" &&
    (node.attributes.type === "submit" || node.attributes.type === "button")
  );
}

function isBackNavigationSubmit(node: KratosUiNode): boolean {
  return (
    isSubmitNode(node) &&
    node.attributes.name === "screen" &&
    node.attributes.value === "previous"
  );
}

function isRenderableInputNode(node: KratosUiNode): boolean {
  return (
    node.type === "input" &&
    typeof node.attributes.name === "string" &&
    node.attributes.name.length > 0 &&
    !isHiddenNode(node) &&
    !isSubmitNode(node)
  );
}

function groupTitle(group: string): string {
  switch (group) {
    case "default":
      return "Main";
    case "password":
      return "Password";
    case "profile":
      return "Profile";
    case "totp":
      return "Authenticator App";
    case "lookup_secret":
      return "Recovery Codes";
    case "oidc":
      return "Single Sign-On";
    case "code":
      return "Code";
    case "link":
      return "Link";
    default:
      return group.charAt(0).toUpperCase() + group.slice(1);
  }
}

function dedupeHiddenNodes(nodes: KratosUiNode[]): KratosUiNode[] {
  const seen = new Set<string>();

  return nodes.filter((node) => {
    const key = `${node.attributes.name ?? ""}:${node.attributes.value ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeNodesByName(nodes: KratosUiNode[]): KratosUiNode[] {
  const seen = new Set<string>();

  return nodes.filter((node) => {
    const name = node.attributes.name?.trim();
    if (!name) return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

export function buildSections(
  flow: KratosBrowserFlow,
  preferredGroups: string[] = [],
  fieldAllowlist: string[] = []
): NodeSection[] {
  const nodes = flow.ui.nodes ?? [];
  const allowedFieldNames = new Set(
    fieldAllowlist
      .map((fieldName) => fieldName.trim())
      .filter((fieldName) => fieldName.length > 0)
  );

  const includeInputNode = (node: KratosUiNode): boolean => {
    if (!isRenderableInputNode(node)) return false;
    if (allowedFieldNames.size === 0) return true;
    const fieldName = node.attributes.name?.trim() || "";
    return allowedFieldNames.has(fieldName);
  };

  const defaultHidden = nodes.filter(
    (node) => (node.group || "default") === "default" && isHiddenNode(node)
  );
  const defaultInputs = dedupeNodesByName(
    nodes.filter(
      (node) => (node.group || "default") === "default" && includeInputNode(node)
    )
  );

  const sectionGroups = Array.from(
    new Set(nodes.filter(isSubmitNode).map((node) => node.group || "default"))
  );

  const preferred = preferredGroups
    .map((group) => group.trim())
    .filter((group) => group.length > 0);

  let groups = sectionGroups.length > 0 ? sectionGroups : ["default"];
  if (preferred.length > 0) {
    const filtered = preferred.filter((group) => groups.includes(group));
    groups = filtered.length > 0 ? filtered : groups;
  }

  return groups.map((group) => {
    const groupNodes = nodes.filter((node) => (node.group || "default") === group);

    const hiddenNodes = dedupeHiddenNodes([
      ...defaultHidden,
      ...groupNodes.filter(isHiddenNode),
    ]);

    const ownInputs = groupNodes.filter(includeInputNode);
    const inputNodes = dedupeNodesByName(
      group === "default" ? ownInputs : [...defaultInputs, ...ownInputs]
    );
    const submitNodes = groupNodes.filter(isSubmitNode);

    return {
      key: group,
      title: groupTitle(group),
      hiddenNodes,
      inputNodes,
      submitNodes,
    };
  });
}

export function filterVisibleSections(
  sections: NodeSection[],
  hideBackOnlySections: boolean
): NodeSection[] {
  if (!hideBackOnlySections) return sections;

  return sections.filter((section) => {
    if (section.inputNodes.length > 0) return true;
    if (section.submitNodes.length === 0) return true;
    return !section.submitNodes.every(isBackNavigationSubmit);
  });
}

export function filterSubmitNodes(
  submitNodes: KratosUiNode[],
  submitAllowlist: string[] = []
): KratosUiNode[] {
  const allowedSubmitNames = new Set(
    submitAllowlist
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
  );

  return submitNodes.filter((node) => {
    if (allowedSubmitNames.size === 0) return true;
    const name = node.attributes.name?.trim() || "";
    return allowedSubmitNames.has(name);
  });
}

