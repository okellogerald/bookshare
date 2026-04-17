"use client";

import { useEffect, useMemo, useState } from "react";
import type { PgMemberProfile } from "@/shared/api";
import { useCommunityMembers } from "@/domains/community/queries";
import { useActiveWishersForBook } from "@/domains/community/queries";
import { useCurrentUser } from "@/shared/providers/user-provider";
import {
  goneReasonLabels,
  type LibraryCopyStatus,
  type StatusTransitionFormState,
  statusAllowsCounterparty,
  statusRequiresCounterparty,
  statusRequiresNotes,
} from "@/shared/lib/copy-status";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

interface CopyStatusTransitionFieldsProps {
  bookId?: string | null;
  values: StatusTransitionFormState;
  onChange: (patch: Partial<StatusTransitionFormState>) => void;
  enabled?: boolean;
}

function getMemberName(member: PgMemberProfile) {
  const fullName = [member.first_name, member.last_name]
    .filter((value): value is string => !!value && value.trim().length > 0)
    .join(" ")
    .trim();
  return fullName || member.email || "Community member";
}

function getMemberDescription(member: PgMemberProfile) {
  return [member.location, member.contact_notes]
    .filter((value): value is string => !!value && value.trim().length > 0)
    .join(" · ");
}

function getStatusNotesCopy(status: LibraryCopyStatus) {
  if (status === "available") {
    return {
      label: "Availability note",
      placeholder:
        "Explain why this copy is available again, for example returned by the borrower.",
      description:
        "Required. This becomes part of the copy timeline so you can trace why the book came back.",
    };
  }

  if (status === "shelved") {
    return {
      label: "Shelving note",
      placeholder:
        "Explain why this copy is being shelved or temporarily removed from circulation.",
      description:
        "Required. Use this to explain why the copy is not currently being shared.",
    };
  }

  if (status === "lent") {
    return {
      label: "Loan note",
      placeholder:
        "Optional details such as return expectations, handoff location, or condition at the time of lending.",
      description:
        "Optional. Add any context that will help you recover or verify the copy later.",
    };
  }

  return {
    label: "Whereabouts note",
    placeholder:
      "Add any details that explain where the book went or how to trace it later.",
    description:
      "Required if you do not record who received the copy.",
  };
}

export function CopyStatusTransitionFields({
  bookId,
  values,
  onChange,
  enabled = true,
}: CopyStatusTransitionFieldsProps) {
  const currentUser = useCurrentUser();
  const [memberSearch, setMemberSearch] = useState("");
  const allowsCounterparty = statusAllowsCounterparty(values.targetStatus);
  const needsMemberOptions =
    enabled && allowsCounterparty && values.counterpartyType === "member";
  const { data: communityMembers, isLoading: isLoadingMembers } =
    useCommunityMembers({}, { enabled: needsMemberOptions });
  const { data: activeWishers } = useActiveWishersForBook(
    enabled && allowsCounterparty ? bookId ?? null : null
  );

  const activeWisherIds = useMemo(
    () => new Set((activeWishers ?? []).map((wisher) => wisher.user_id)),
    [activeWishers]
  );

  const memberOptions = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    const members = (communityMembers ?? []).filter(
      (member) => member.user_id !== currentUser?.id
    );

    const selectedMember =
      values.counterpartyUserId
        ? members.find((member) => member.user_id === values.counterpartyUserId)
        : undefined;

    const filtered = members.filter((member) => {
      if (!term) return true;

      const haystack = [
        member.first_name,
        member.last_name,
        member.email,
        member.location,
        member.contact_notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });

    const withSelected =
      selectedMember &&
      !filtered.some((member) => member.user_id === selectedMember.user_id)
        ? [selectedMember, ...filtered]
        : filtered;

    return withSelected.sort((left, right) => {
      const activeWishScore =
        Number(activeWisherIds.has(right.user_id)) -
        Number(activeWisherIds.has(left.user_id));
      if (activeWishScore !== 0) return activeWishScore;

      return getMemberName(left).localeCompare(getMemberName(right), undefined, {
        sensitivity: "base",
      });
    });
  }, [
    activeWisherIds,
    communityMembers,
    currentUser?.id,
    memberSearch,
    values.counterpartyUserId,
  ]);

  const noteCopy = getStatusNotesCopy(values.targetStatus);

  useEffect(() => {
    setMemberSearch("");
  }, [bookId, values.counterpartyType, values.targetStatus]);

  return (
    <div className="space-y-4">
      {values.targetStatus === "gone" ? (
        <div className="space-y-2">
          <Label>Gone reason</Label>
          <Select
            value={values.goneReason}
            onValueChange={(value) =>
              onChange({
                goneReason: value as StatusTransitionFormState["goneReason"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select why this copy is gone" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(goneReasonLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {allowsCounterparty ? (
        <div className="space-y-2">
          <Label>
            {values.targetStatus === "lent"
              ? "Who has the book now?"
              : "Who received the copy?"}
          </Label>
          <Select
            value={values.counterpartyType}
            onValueChange={(value) =>
              onChange({
                counterpartyType:
                  value as StatusTransitionFormState["counterpartyType"],
                counterpartyUserId: "",
                externalCounterpartyName: "",
                externalCounterpartyContact: "",
              })
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  statusRequiresCounterparty(values.targetStatus)
                    ? "Select a counterparty type"
                    : "Optional: record who received the copy"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Community member</SelectItem>
              <SelectItem value="external">External person</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {values.targetStatus === "lent"
              ? "Required. Borrowed copies should always record who has them."
              : "Optional. Record the recipient when you want the platform to retain whereabouts information."}
          </p>
        </div>
      ) : null}

      {values.counterpartyType === "member" ? (
        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-2">
            <Label>Find community member</Label>
            <Input
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="Search by name, email, location, or contact notes"
            />
          </div>

          <div className="space-y-2">
            <Label>Community member</Label>
            <Select
              value={values.counterpartyUserId}
              onValueChange={(value) =>
                onChange({
                  counterpartyUserId: value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select the community member" />
              </SelectTrigger>
              <SelectContent>
                {memberOptions.map((member) => {
                  const description = getMemberDescription(member);
                  const label = activeWisherIds.has(member.user_id)
                    ? `${getMemberName(member)} (active wish)`
                    : getMemberName(member);

                  return (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {description ? `${label} - ${description}` : label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {isLoadingMembers ? (
              <p className="text-xs text-muted-foreground">
                Loading community members...
              </p>
            ) : null}
            {!isLoadingMembers && memberOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No community members match your search.
              </p>
            ) : null}
            {activeWisherIds.size > 0 ? (
              <p className="text-xs text-muted-foreground">
                Members marked with active wish will have that wish closed
                automatically when this status change is saved.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {values.counterpartyType === "external" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Recipient name</Label>
            <Input
              value={values.externalCounterpartyName}
              onChange={(event) =>
                onChange({
                  externalCounterpartyName: event.target.value,
                })
              }
              placeholder="Name or label for the person who received the copy"
            />
          </div>
          <div className="space-y-2">
            <Label>Recipient contact</Label>
            <Input
              value={values.externalCounterpartyContact}
              onChange={(event) =>
                onChange({
                  externalCounterpartyContact: event.target.value,
                })
              }
              placeholder="Phone, email, address, or other recovery detail"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>
          {noteCopy.label}
          {statusRequiresNotes(values.targetStatus) ? " *" : ""}
        </Label>
        <Textarea
          value={values.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder={noteCopy.placeholder}
        />
        <p className="text-xs text-muted-foreground">{noteCopy.description}</p>
      </div>
    </div>
  );
}
