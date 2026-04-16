import type { KratosUiNode } from "@/shared/lib/kratos";

export interface FooterLink {
  href: string;
  label: string;
}

export interface NodeSection {
  key: string;
  title: string;
  hiddenNodes: KratosUiNode[];
  inputNodes: KratosUiNode[];
  submitNodes: KratosUiNode[];
}

