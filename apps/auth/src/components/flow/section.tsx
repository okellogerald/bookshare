"use client";

import { useState, type FormEvent } from "react";
import type { KratosBrowserFlow } from "@/lib/kratos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FlowField } from "./field";
import { filterSubmitNodes } from "./partition";
import type { NodeSection } from "./types";
import type { KratosUiNode } from "@/lib/kratos";

interface FlowSectionProps {
  flow: KratosBrowserFlow;
  section: NodeSection;
  submitAllowlist?: string[];
  readonlyFieldNames?: string[];
  hasMultipleSections: boolean;
  enablePasswordConfirmation?: boolean;
}

export function FlowSection({
  flow,
  section,
  submitAllowlist = [],
  readonlyFieldNames = [],
  hasMultipleSections,
  enablePasswordConfirmation = false,
}: FlowSectionProps) {
  const visibleSubmits = filterSubmitNodes(section.submitNodes, submitAllowlist);
  const readonlyNameSet = new Set(
    readonlyFieldNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
  );
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const needsPasswordConfirmation =
    enablePasswordConfirmation && section.key === "password";

  const getTraitValueForNode = (nodeName?: string): string | undefined => {
    if (!nodeName || !nodeName.startsWith("traits.")) return undefined;
    const traitPath = nodeName.slice("traits.".length);
    if (!traitPath) return undefined;

    const segments = traitPath.split(".").filter((segment) => segment.length > 0);
    let current: unknown = flow.identity?.traits;

    for (const segment of segments) {
      if (!current || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[segment];
    }

    if (typeof current === "string") return current;
    if (typeof current === "number" || typeof current === "boolean") {
      return String(current);
    }

    return undefined;
  };

  const withFallbackValue = (node: KratosUiNode): KratosUiNode => {
    const currentValue = node.attributes.value;
    if (typeof currentValue === "string" && currentValue.trim().length > 0) {
      return node;
    }

    const fallbackValue = getTraitValueForNode(node.attributes.name);
    if (typeof fallbackValue !== "string" || fallbackValue.length === 0) {
      return node;
    }

    return {
      ...node,
      attributes: {
        ...node.attributes,
        value: fallbackValue,
      },
    };
  };

  const resolvedHiddenNodes = section.hiddenNodes.map(withFallbackValue);
  const resolvedInputNodes = section.inputNodes.map(withFallbackValue);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!needsPasswordConfirmation) return;

    const passwordInput = event.currentTarget.elements.namedItem("password");
    const password =
      passwordInput instanceof HTMLInputElement ? passwordInput.value : "";
    const confirmation = confirmPassword.trim();

    if (confirmation.length === 0) {
      event.preventDefault();
      setConfirmError("Please confirm your password.");
      return;
    }

    if (password !== confirmation) {
      event.preventDefault();
      setConfirmError("Passwords do not match.");
      return;
    }

    setConfirmError(null);
  };

  return (
    <section className="flow-section">
      {hasMultipleSections ? (
        <h2 className="flow-section-title">{section.title}</h2>
      ) : null}

      <form
        action={flow.ui.action}
        method={flow.ui.method.toLowerCase()}
        className="flow-form"
        onSubmit={handleSubmit}
      >
        {resolvedHiddenNodes.map((node, index) => (
          <input
            key={`${section.key}-hidden-${node.attributes.name ?? ""}-${index}`}
            type="hidden"
            name={node.attributes.name}
            defaultValue={node.attributes.value}
          />
        ))}

        {resolvedInputNodes.map((node, index) => (
          <FlowField
            key={`${section.key}-${node.attributes.name ?? index}-${index}`}
            node={node}
            index={index}
            actionUrl={flow.ui.action}
            sectionKey={section.key}
            readOnly={readonlyNameSet.has(node.attributes.name?.trim() ?? "")}
          />
        ))}

        {needsPasswordConfirmation ? (
          <div className="space-y-2">
            <Label htmlFor="flow-confirm-password" className="flow-field-label">
              Confirm password
            </Label>
            <Input
              id="flow-confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.currentTarget.value);
                if (confirmError) setConfirmError(null);
              }}
            />
          </div>
        ) : null}

        {confirmError ? (
          <p className="flow-node-message flow-node-message-error text-xs">{confirmError}</p>
        ) : null}

        <div className="flow-actions">
          {visibleSubmits.length > 0 ? (
            visibleSubmits.map((node, index) => (
              <Button
                key={`${section.key}-submit-${node.attributes.name ?? index}-${index}`}
                type="submit"
                name={node.attributes.name}
                value={node.attributes.value}
                variant={index === 0 ? "default" : "outline"}
                className="flow-submit-button"
              >
                {node.meta?.label?.text || node.attributes.value || "Submit"}
              </Button>
            ))
          ) : (
            <Button type="submit" className="flow-submit-button">
              Submit
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
