import type { UpdateCopyStatusBody } from "@/shared/api";

export type LibraryCopyStatus = "available" | "shelved" | "lent" | "gone";
export type GoneReason = "sold" | "donated" | "given_away" | "lost";
export type CounterpartyType = "member" | "external";

export interface StatusTransitionFormState {
  targetStatus: LibraryCopyStatus;
  notes: string;
  goneReason: GoneReason | "";
  counterpartyType: CounterpartyType | "";
  counterpartyUserId: string;
  externalCounterpartyName: string;
  externalCounterpartyContact: string;
}

export const statusLabels: Record<LibraryCopyStatus, string> = {
  available: "Available",
  shelved: "Shelved",
  lent: "Lent",
  gone: "Gone",
};

export const statusActionLabels: Record<LibraryCopyStatus, string> = {
  available: "Mark Available",
  shelved: "Mark Shelved",
  lent: "Mark Lent",
  gone: "Mark Gone",
};

export const shareTypeLabels: Record<string, string> = {
  lend: "Lend",
  sell: "Sell",
  give_away: "Give Away",
};

export const goneReasonLabels: Record<GoneReason, string> = {
  sold: "Sold",
  donated: "Donated",
  given_away: "Given Away",
  lost: "Lost",
};

function trimToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function getDefaultGoneReason(
  shareType: string | null | undefined
): GoneReason | "" {
  if (shareType === "sell") return "sold";
  if (shareType === "give_away") return "given_away";
  return "";
}

export function createStatusTransitionFormState(
  targetStatus: LibraryCopyStatus,
  shareType: string | null | undefined
): StatusTransitionFormState {
  return {
    targetStatus,
    notes: "",
    goneReason: targetStatus === "gone" ? getDefaultGoneReason(shareType) : "",
    counterpartyType: "",
    counterpartyUserId: "",
    externalCounterpartyName: "",
    externalCounterpartyContact: "",
  };
}

export function statusAllowsCounterparty(status: LibraryCopyStatus) {
  return status === "lent" || status === "gone";
}

export function statusRequiresCounterparty(status: LibraryCopyStatus) {
  return status === "lent";
}

export function statusRequiresNotes(status: LibraryCopyStatus) {
  return status === "available" || status === "shelved";
}

export function getStatusTransitionValidationMessage(
  values: StatusTransitionFormState
) {
  const notes = trimToUndefined(values.notes);

  if (statusRequiresNotes(values.targetStatus) && !notes) {
    return values.targetStatus === "available"
      ? "Add a note explaining why this copy is available again."
      : "Add a note explaining why this copy is being shelved.";
  }

  if (values.targetStatus === "lent" && !values.counterpartyType) {
    return "Select who currently has the book.";
  }

  if (values.targetStatus === "gone" && !values.goneReason) {
    return "Select why this copy is gone.";
  }

  if (
    values.targetStatus === "gone" &&
    !values.counterpartyType &&
    !notes
  ) {
    return "Add notes or record who received the copy.";
  }

  if (values.counterpartyType === "member" && !values.counterpartyUserId) {
    return "Select the community member who has the book.";
  }

  if (
    values.counterpartyType === "external" &&
    !trimToUndefined(values.externalCounterpartyName)
  ) {
    return "Enter the recipient name.";
  }

  return null;
}

export function buildStatusTransitionBody(
  values: StatusTransitionFormState
): UpdateCopyStatusBody {
  const body: UpdateCopyStatusBody = {
    status: values.targetStatus,
  };

  const notes = trimToUndefined(values.notes);
  if (notes) {
    body.notes = notes;
  }

  if (values.targetStatus === "gone" && values.goneReason) {
    body.goneReason = values.goneReason;
  }

  if (!statusAllowsCounterparty(values.targetStatus) || !values.counterpartyType) {
    return body;
  }

  body.counterpartyType = values.counterpartyType;

  if (values.counterpartyType === "member" && values.counterpartyUserId) {
    body.counterpartyUserId = values.counterpartyUserId;
    return body;
  }

  const externalCounterpartyName = trimToUndefined(
    values.externalCounterpartyName
  );
  const externalCounterpartyContact = trimToUndefined(
    values.externalCounterpartyContact
  );

  if (externalCounterpartyName) {
    body.externalCounterpartyName = externalCounterpartyName;
  }

  if (externalCounterpartyContact) {
    body.externalCounterpartyContact = externalCounterpartyContact;
  }

  return body;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message.replace(/^API error \(\d+\):\s*/, "") || fallback;
  }

  return fallback;
}
