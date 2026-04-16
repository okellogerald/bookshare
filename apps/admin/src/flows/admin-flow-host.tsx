"use client";

import { RightPanel } from "@/shared/components/right-panel";
import type { AdminFlow } from "./types";
import { ManageTeamMemberFlow } from "./manage-team-member";
import { AddEditionFlow } from "./add-edition";
import { AddTeamMemberFlow } from "./add-team-member";
import { CatalogSearchFlow } from "./catalog-search";
import { ImportBatchFlow } from "./import-batch";

function getFlowChrome(flow: AdminFlow) {
  switch (flow.kind) {
    case "add-edition":
      return {
        title: "Add New Edition",
        description:
          "Step through title lookup, author selection, edition details, and the final confirmation review.",
        size: "moderate" as const,
      };
    case "catalog-search":
      return {
        title: "Catalog Search",
        description:
          "Search the live catalog in a focused flow, then close the panel when you have what you need.",
        size: "lg" as const,
      };
    case "import-batch":
      return {
        title: "Import Batch",
        description: "Choose the run type, validate the ZIP, and review the run before commit.",
        size: "moderate" as const,
      };
    case "add-team-member":
      return {
        title: "Add Team Member",
        description:
          "Search identities and grant the right role without leaving the team directory.",
        size: "lg" as const,
      };
    case "manage-team-member":
      return {
        title: "Manage Team Roles",
        description:
          "Review the selected team member’s current roles and make changes in this isolated flow.",
        size: "lg" as const,
      };
  }
}

export function AdminFlowHost({
  activeFlow,
  onClose,
}: {
  activeFlow: AdminFlow | null;
  onClose: () => void;
}) {
  if (!activeFlow) {
    return null;
  }

  const chrome = getFlowChrome(activeFlow);

  return (
    <RightPanel
      open
      onClose={onClose}
      title={chrome.title}
      description={chrome.description}
      size={chrome.size}
    >
      {activeFlow.kind === "add-edition" ? (
        <AddEditionFlow onClose={onClose} />
      ) : activeFlow.kind === "catalog-search" ? (
        <CatalogSearchFlow />
      ) : activeFlow.kind === "import-batch" ? (
        <ImportBatchFlow />
      ) : activeFlow.kind === "add-team-member" ? (
        <AddTeamMemberFlow actorRoles={activeFlow.actorRoles} onComplete={onClose} />
      ) : (
        <ManageTeamMemberFlow
          actorRoles={activeFlow.actorRoles}
          entry={activeFlow.entry}
          onClose={onClose}
        />
      )}
    </RightPanel>
  );
}
