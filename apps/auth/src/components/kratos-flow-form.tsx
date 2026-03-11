import { getFlowMessages, type KratosBrowserFlow } from "@/lib/kratos";
import { AuthShell } from "./auth-shell";
import { FlowFooterLinks } from "./flow/footer-links";
import { FlowMessages } from "./flow/messages";
import { buildSections, filterVisibleSections } from "./flow/partition";
import { FlowSection } from "./flow/section";
import type { FooterLink } from "./flow/types";

interface KratosFlowFormProps {
  flow: KratosBrowserFlow;
  title: string;
  description: string;
  links?: FooterLink[];
  sectionGroups?: string[];
  fieldAllowlist?: string[];
  readonlyFieldNames?: string[];
  submitAllowlist?: string[];
  hideBackOnlySections?: boolean;
  enablePasswordConfirmation?: boolean;
}

export function KratosFlowForm({
  flow,
  title,
  description,
  links = [],
  sectionGroups = [],
  fieldAllowlist = [],
  readonlyFieldNames = [],
  submitAllowlist = [],
  hideBackOnlySections = false,
  enablePasswordConfirmation = false,
}: KratosFlowFormProps) {
  const messages = getFlowMessages(flow);
  const sections = buildSections(flow, sectionGroups, fieldAllowlist);
  const visibleSections = filterVisibleSections(sections, hideBackOnlySections);
  const hasMultipleSections = visibleSections.length > 1;

  return (
    <AuthShell title={title} description={description}>
      <FlowMessages messages={messages} />
      {visibleSections.map((section) => (
        <FlowSection
          key={section.key}
          flow={flow}
          section={section}
          submitAllowlist={submitAllowlist}
          hasMultipleSections={hasMultipleSections}
          readonlyFieldNames={readonlyFieldNames}
          enablePasswordConfirmation={enablePasswordConfirmation}
        />
      ))}
      <FlowFooterLinks links={links} />
    </AuthShell>
  );
}
