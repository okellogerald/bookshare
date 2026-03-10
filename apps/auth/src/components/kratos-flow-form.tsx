import Link from "next/link";
import {
  type KratosBrowserFlow,
  type KratosUiNode,
  getFieldAutoComplete,
  getFlowMessages,
  getNodeLabel,
} from "@/lib/kratos";

interface FooterLink {
  href: string;
  label: string;
}

interface KratosFlowFormProps {
  flow: KratosBrowserFlow;
  title: string;
  description: string;
  links?: FooterLink[];
  sectionGroups?: string[];
  fieldAllowlist?: string[];
  submitAllowlist?: string[];
  hideBackOnlySections?: boolean;
}

interface NodeSection {
  key: string;
  title: string;
  hiddenNodes: KratosUiNode[];
  inputNodes: KratosUiNode[];
  submitNodes: KratosUiNode[];
}

function toFieldId(name: string): string {
  return `field-${name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
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
  const fallback = new Set<number>();

  return nodes.filter((node, idx) => {
    const name = node.attributes.name?.trim();

    if (name) {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    }

    if (fallback.has(idx)) return false;
    fallback.add(idx);
    return true;
  });
}

function buildSections(
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
    (node) => node.group === "default" && isHiddenNode(node)
  );
  const defaultInputs = dedupeNodesByName(
    nodes.filter((node) => (node.group || "default") === "default" && includeInputNode(node))
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
      group === "default"
        ? ownInputs
        : [...defaultInputs, ...ownInputs]
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

export function KratosFlowForm({
  flow,
  title,
  description,
  links = [],
  sectionGroups = [],
  fieldAllowlist = [],
  submitAllowlist = [],
  hideBackOnlySections = false,
}: KratosFlowFormProps) {
  const messages = getFlowMessages(flow);
  const sections = buildSections(flow, sectionGroups, fieldAllowlist);
  const allowedSubmitNames = new Set(
    submitAllowlist
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
  );
  const visibleSections = hideBackOnlySections
    ? sections.filter((section) => {
      if (section.inputNodes.length > 0) return true;
      if (section.submitNodes.length === 0) return true;
      return !section.submitNodes.every(isBackNavigationSubmit);
    })
    : sections;
  const hasMultipleSections = visibleSections.length > 1;

  function getMessageClass(type: KratosUiNode["messages"][number]["type"]): string {
    if (type === "error") return "message error";
    if (type === "success") return "message success";
    if (type === "warning") return "message warning";
    return "message info";
  }

  return (
    <div className="page">
      <div className="card">
        <header className="card-header">
          <p className="eyebrow">BookShare Identity</p>
          <h1 className="title">{title}</h1>
          <p className="subtitle">{description}</p>
        </header>

        {messages.length > 0 && (
          <div className="message-list">
            {messages.map((message, idx) => (
              <p
                key={`${message.id ?? idx}-${idx}`}
                className={getMessageClass(message.type)}
              >
                {message.text}
              </p>
            ))}
          </div>
        )}

        {visibleSections.map((section) => (
          <section className="section" key={section.key}>
            {hasMultipleSections ? <h2>{section.title}</h2> : null}
            <form action={flow.ui.action} method={flow.ui.method.toLowerCase()} className="form">
              {section.hiddenNodes.map((node, idx) => (
                <input
                  key={`${section.key}-hidden-${node.attributes.name ?? ""}-${idx}`}
                  type="hidden"
                  name={node.attributes.name}
                  defaultValue={node.attributes.value}
                />
              ))}

              {section.inputNodes.map((node, idx) => {
                const name = node.attributes.name || `field-${idx}`;
                const fieldId = toFieldId(name);
                const inputType = node.attributes.type || "text";
                const isCheckbox = inputType === "checkbox";
                const isCodeField = name === "code" || name.endsWith("_code");

                return (
                  <label key={`${section.key}-${name}-${idx}`} htmlFor={fieldId} className="label">
                    <span>{getNodeLabel(node)}</span>
                    <input
                      id={fieldId}
                      className={isCheckbox ? "checkbox" : "input"}
                      name={name}
                      type={inputType}
                      defaultValue={
                        isCheckbox
                          ? undefined
                          : typeof node.attributes.value === "string"
                            ? node.attributes.value
                            : ""
                      }
                      defaultChecked={
                        isCheckbox &&
                        (node.attributes.value === "true" || node.attributes.value === "on")
                      }
                      required={Boolean(node.attributes.required)}
                      disabled={Boolean(node.attributes.disabled)}
                      autoComplete={getFieldAutoComplete(name, inputType, flow.ui.action)}
                      inputMode={isCodeField ? "numeric" : undefined}
                    />
                    {node.messages?.map((message, messageIdx) => (
                      <p
                        className={`node-message ${message.type}`}
                        key={`${name}-message-${message.id ?? messageIdx}`}
                      >
                        {message.text}
                      </p>
                    ))}
                  </label>
                );
              })}

              <div className="actions">
                {section.submitNodes.length > 0 ? (
                  section.submitNodes
                    .filter((node) => {
                      if (allowedSubmitNames.size === 0) return true;
                      const name = node.attributes.name?.trim() || "";
                      return allowedSubmitNames.has(name);
                    })
                    .map((node, idx) => (
                    <button
                      key={`${section.key}-submit-${node.attributes.name ?? idx}`}
                      className={idx === 0 ? "button" : "button secondary"}
                      type="submit"
                      name={node.attributes.name}
                      value={node.attributes.value}
                    >
                      {node.meta?.label?.text || node.attributes.value || "Submit"}
                    </button>
                    ))
                ) : (
                  <button className="button" type="submit">
                    Submit
                  </button>
                )}
              </div>
            </form>
          </section>
        ))}

        {links.length > 0 && (
          <div className="footer-links">
            {links.map((link) => (
              <Link key={`${link.href}-${link.label}`} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
