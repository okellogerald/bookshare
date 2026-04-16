import type {
  KratosBrowserFlow,
  KratosUiMessage,
  KratosUiNode,
} from "@/shared/lib/kratos";
import {
  findSubmitNode,
  findVisibleFieldNode,
  getResolvedNodeValue,
  getTraitValue,
  normalizeGroup,
  resolveHiddenFields,
} from "@/shared/lib/kratos-ui";

type SettingsSection = "profile" | "password";
type SettingsMode = "account" | "recovery-reset";
type SettingsCommonFieldKey = "email" | "firstName" | "lastName" | "gender";
type SettingsFieldKey = SettingsCommonFieldKey | "password";
type SettingsFieldType = "email" | "text" | "password" | "select";

interface SettingsFieldDefinition<TKey extends SettingsFieldKey = SettingsFieldKey> {
  /** Stable UI key used by the settings feature. */
  key: TKey;
  /** Kratos node name that supplies this field's value. */
  name: string;
  /** User-facing label rendered by the settings UI. */
  label: string;
  /** Input widget type the settings UI should render. */
  type: SettingsFieldType;
}

const SETTINGS_PROFILE_FIELDS: readonly SettingsFieldDefinition<SettingsCommonFieldKey>[] = [
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

const SETTINGS_PASSWORD_FIELD: SettingsFieldDefinition<"password"> = {
  key: "password",
  name: "password",
  label: "Password",
  type: "password",
};

function toSubmitModel(
  node: KratosUiNode,
  fallbackLabel: string
): SettingsSubmitModel {
  return {
    name: node.attributes.name,
    value: node.attributes.value,
    label: node.meta?.label?.text?.trim() || fallbackLabel,
    group: normalizeGroup(node.group),
  };
}

function toFieldModel(
  flow: KratosBrowserFlow,
  node: KratosUiNode,
  definition: SettingsFieldDefinition
): SettingsFieldModel {
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
  definition: SettingsFieldDefinition
): SettingsFieldModel {
  return toFieldModel(
    flow,
    findVisibleFieldNode(
      flow,
      definition.name,
      `Settings flow expected exactly one visible '${definition.name}' node.`
    ),
    definition
  );
}

function resolveProfileFields(
  flow: KratosBrowserFlow
): Record<SettingsCommonFieldKey, SettingsFieldModel> {
  return Object.fromEntries(
    SETTINGS_PROFILE_FIELDS.map((definition) => [
      definition.key,
      resolveField(flow, definition),
    ])
  ) as Record<SettingsCommonFieldKey, SettingsFieldModel>;
}

function resolveAccountEmail(flow: KratosBrowserFlow): string {
  const traitEmail = getTraitValue(flow, "traits.email")?.trim();
  if (traitEmail) {
    return traitEmail;
  }

  return resolveField(
    flow,
    SETTINGS_PROFILE_FIELDS.find((field) => field.key === "email")!
  ).value.trim();
}

interface SettingsPageLinks {
  /** Link that reloads the current settings section from a fresh flow. */
  retryHref: string;
  /** Link to the profile section of settings. */
  profileSectionHref: string;
  /** Link to the password section of settings. */
  passwordSectionHref: string;
  /** Link back out of settings to the appropriate auth-owned destination. */
  backHref: string;
  /** Label shown for the back link. */
  backLabel: string;
}

interface BuildSettingsModelOptions {
  /** Product-owned section that should be rendered from the shared settings flow. */
  activeSection: SettingsSection;
  /** Whether settings is being used for normal account management or recovery reset. */
  mode: SettingsMode;
  /** Footer links available to the rendered settings page. */
  links: SettingsPageLinks;
}

/**
 * Hidden Kratos inputs that must be posted back unchanged on the next
 * settings submission.
 */
export interface SettingsHiddenField {
  /** Hidden input name expected by Kratos. */
  name: string;
  /** Hidden input value resolved from the current flow. */
  value: string;
  /** Kratos group that originally owned the hidden node. */
  group: string;
}

/**
 * Normalized field data for a single settings input.
 */
export interface SettingsFieldModel {
  /** Stable field identifier used by the settings feature. */
  key: SettingsFieldKey;
  /** Kratos field name submitted with the settings form. */
  name: string;
  /** User-facing label shown next to the input. */
  label: string;
  /** Input widget type the UI should render. */
  type: SettingsFieldType;
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
 * Normalized submit button metadata for settings actions.
 */
export interface SettingsSubmitModel {
  /** Submit field name Kratos expects on settings submission. */
  name?: string;
  /** Submit field value Kratos expects on settings submission. */
  value?: string;
  /** Button label rendered in the BookShare settings form. */
  label: string;
  /** Kratos group the submit node belongs to. */
  group: string;
}

/**
 * Properties shared by every successful settings page variant.
 */
interface SettingsStepModelBase extends SettingsPageLinks {
  /** Whether the settings page is normal account management or recovery reset. */
  mode: SettingsMode;
  /** Kratos flow identifier for the current settings flow. */
  flowId: string;
  /** Kratos form action URL for settings submission. */
  action: string;
  /** HTTP method Kratos expects for the settings form. */
  method: string;
  /** Flow-level messages returned by Kratos. */
  messages: KratosUiMessage[];
  /** Hidden inputs that preserve Kratos flow state across submissions. */
  hiddenFields: SettingsHiddenField[];
  /** Best-effort account email used for titles and descriptions. */
  accountEmail: string;
}

/**
 * Profile section model for normal account management.
 */
export interface SettingsProfileStepModel extends SettingsStepModelBase {
  /** Discriminator for the profile section. */
  variant: "profile";
  /** Profile settings are only rendered during normal account management. */
  mode: "account";
  /** Visible profile fields rendered by the profile form. */
  fields: Record<SettingsCommonFieldKey, SettingsFieldModel>;
  /** Primary action that saves profile changes. */
  submit: SettingsSubmitModel;
}

/**
 * Password section model for normal password changes or recovery-triggered
 * password resets.
 */
export interface SettingsPasswordStepModel extends SettingsStepModelBase {
  /** Discriminator for the password section. */
  variant: "password";
  /** Whether this password form is a normal change or a recovery reset. */
  mode: SettingsMode;
  /** Visible password field rendered by the password form. */
  passwordField: SettingsFieldModel;
  /** Primary action that saves the new password. */
  submit: SettingsSubmitModel;
}

/**
 * Recoverable page model used when the settings flow cannot be mapped into the
 * supported BookShare profile or password shapes.
 */
export interface SettingsErrorPageModel extends SettingsPageLinks {
  /** Discriminator for the recoverable settings error page. */
  variant: "error";
  /** Whether the failure happened during normal settings or recovery reset. */
  mode: SettingsMode;
  /** Page title shown when settings cannot continue. */
  title: string;
  /** User-facing explanation of the failure state. */
  description: string;
  /** Lower-level detail that explains the mapping failure. */
  detail?: string;
}

/**
 * Union of all settings page states the route can render.
 */
export type SettingsPageModel =
  | SettingsProfileStepModel
  | SettingsPasswordStepModel
  | SettingsErrorPageModel;

/**
 * Converts the raw Kratos settings flow into the explicit BookShare settings
 * model for the requested product-owned section.
 *
 * The function is necessary because Kratos returns profile and password nodes
 * together, while the BookShare UI intentionally renders one independently
 * maintained settings form at a time.
 */
export function buildSettingsModel(
  flow: KratosBrowserFlow,
  options: BuildSettingsModelOptions
): SettingsPageModel {
  const baseModel = {
    flowId: flow.id,
    action: flow.ui.action,
    method: flow.ui.method.toLowerCase(),
    messages: flow.ui.messages ?? [],
    hiddenFields: resolveHiddenFields(flow) as SettingsHiddenField[],
    accountEmail: resolveAccountEmail(flow),
    retryHref: options.links.retryHref,
    profileSectionHref: options.links.profileSectionHref,
    passwordSectionHref: options.links.passwordSectionHref,
    backHref: options.links.backHref,
    backLabel: options.links.backLabel,
  };

  if (options.activeSection === "password") {
    const submit = findSubmitNode(
      flow,
      { group: "password", name: "method", value: "password" },
      "Settings flow expected exactly one password submit node."
    );

    return {
      variant: "password",
      mode: options.mode,
      ...baseModel,
      passwordField: resolveField(flow, SETTINGS_PASSWORD_FIELD),
      submit: toSubmitModel(submit, "Save password"),
    };
  }

  const submit = findSubmitNode(
    flow,
    { group: "profile", name: "method", value: "profile" },
    "Settings flow expected exactly one profile submit node."
  );

  return {
    variant: "profile",
    mode: "account",
    ...baseModel,
    fields: resolveProfileFields(flow),
    submit: toSubmitModel(submit, "Save profile"),
  };
}
