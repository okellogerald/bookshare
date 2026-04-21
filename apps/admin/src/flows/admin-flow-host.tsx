"use client";

import { RightPanel } from "@/shared/components/right-panel";
import type { AdminFlow } from "./types";
import { ManageTeamMemberFlow } from "./manage-team-member";
import { AddEditionFlow } from "./add-edition";
import { AddTitleFlow } from "./add-title";
import { AddCopyFlow } from "./add-copy";
import { AddWishFlow } from "./add-wish";
import { AddTeamMemberFlow } from "./add-team-member";
import { CreateBookstoreFlow } from "./create-bookstore";
import { EditBookstoreFlow } from "./edit-bookstore";
import { CatalogSearchFlow } from "./catalog-search";
import { ImportBatchFlow } from "./import-batch";
import { ReviewCopySubmissionFlow } from "./review-copy-submission";
import { ReviewWantSubmissionFlow } from "./review-want-submission";
import { EditBookFlow } from "./edit-book";
import { EditEditionFlow } from "./edit-edition";
import { EditCopyFlow } from "./edit-copy";
import { EditWishFlow } from "./edit-wish";

function getFlowChrome(flow: AdminFlow) {
  switch (flow.kind) {
    case "add-title":
      return {
        title: "Add New Title",
        description: "Create a new book record with title details and authors.",
        size: "md" as const,
      };
    case "add-copy":
      return {
        title: "Add New Copy",
        description: "Create a copy on behalf of a member by selecting a member, edition, and details.",
        size: "moderate" as const,
      };
    case "add-wish":
      return {
        title: "Add New Wish",
        description: "Create a wish on behalf of a member by selecting a member and book.",
        size: "moderate" as const,
      };
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
    case "create-bookstore":
      return {
        title: "Create Bookstore",
        description:
          "Register a new bookstore organization, link an owner admin identity, and issue a first-time recovery link.",
        size: "moderate" as const,
      };
    case "edit-bookstore":
      return {
        title: "Edit Bookstore",
        description: `Update organization contact details for "${flow.bookstore.name}".`,
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
          "Review the selected team member's current roles and make changes in this isolated flow.",
        size: "lg" as const,
      };
    case "review-copy-submission":
      return {
        title: "Review Copy Submission",
        description: "Review the member's submitted data and create the catalog entry.",
        size: "xl" as const,
      };
    case "review-want-submission":
      return {
        title: "Review Want Submission",
        description: "Review the member's want request and link it to a catalog book.",
        size: "xl" as const,
      };
    case "edit-book":
      return {
        title: "Edit Book",
        description: `Update title, subtitle, language, and authors for "${flow.book.title}".`,
        size: "md" as const,
      };
    case "edit-edition":
      return {
        title: "Edit Edition",
        description: `Update edition details and cover image for "${flow.edition.book?.title ?? "this edition"}".`,
        size: "md" as const,
      };
    case "edit-copy":
      return {
        title: "Edit Copy",
        description: `Update condition, share type, and notes for this copy of "${flow.copy.edition?.book?.title ?? "unknown title"}".`,
        size: "md" as const,
      };
    case "edit-wish":
      return {
        title: "Edit Want",
        description: `Update notes for this want for "${flow.wish.book?.title ?? "unknown title"}".`,
        size: "md" as const,
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
      {activeFlow.kind === "add-title" ? (
        <AddTitleFlow onClose={onClose} />
      ) : activeFlow.kind === "add-copy" ? (
        <AddCopyFlow onClose={onClose} />
      ) : activeFlow.kind === "add-wish" ? (
        <AddWishFlow onClose={onClose} />
      ) : activeFlow.kind === "add-edition" ? (
        <AddEditionFlow onClose={onClose} />
      ) : activeFlow.kind === "catalog-search" ? (
        <CatalogSearchFlow />
      ) : activeFlow.kind === "import-batch" ? (
        <ImportBatchFlow />
      ) : activeFlow.kind === "create-bookstore" ? (
        <CreateBookstoreFlow onClose={onClose} />
      ) : activeFlow.kind === "edit-bookstore" ? (
        <EditBookstoreFlow bookstore={activeFlow.bookstore} onClose={onClose} />
      ) : activeFlow.kind === "add-team-member" ? (
        <AddTeamMemberFlow actorRoles={activeFlow.actorRoles} onComplete={onClose} />
      ) : activeFlow.kind === "manage-team-member" ? (
        <ManageTeamMemberFlow
          actorRoles={activeFlow.actorRoles}
          entry={activeFlow.entry}
          onClose={onClose}
        />
      ) : activeFlow.kind === "review-copy-submission" ? (
        <ReviewCopySubmissionFlow submission={activeFlow.submission} onClose={onClose} />
      ) : activeFlow.kind === "review-want-submission" ? (
        <ReviewWantSubmissionFlow submission={activeFlow.submission} onClose={onClose} />
      ) : activeFlow.kind === "edit-book" ? (
        <EditBookFlow book={activeFlow.book} onClose={onClose} />
      ) : activeFlow.kind === "edit-edition" ? (
        <EditEditionFlow edition={activeFlow.edition} onClose={onClose} />
      ) : activeFlow.kind === "edit-copy" ? (
        <EditCopyFlow copy={activeFlow.copy} onClose={onClose} />
      ) : (
        <EditWishFlow wish={activeFlow.wish} onClose={onClose} />
      )}
    </RightPanel>
  );
}
