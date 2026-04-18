"use client";

import { useDeferredValue, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { FlowStepper } from "@/shared/components/flow-stepper";
import {
  type AdminCreateCopyInput,
  type CatalogEditionRecord,
  useCatalogBookSearch,
  useEditionsByBook,
  useAdminCreateCopy,
} from "@/domain/catalog/queries";
import type { MemberDirectoryEntry } from "@/domain/members/queries";
import { useMemberDirectory } from "@/domain/members/queries";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { Flex, Stack } from "@/shared/components/ui/flex";
import {
  SelectableItem,
  SelectableList,
} from "@/shared/components/ui/selectable-list";
import { FlowSummaryRow } from "@/shared/components/flow-summary-row";
import type { PgBookWithAuthorsView } from "@/shared/api";

type AddCopyStep = 1 | 2 | 3 | 4;

const stepItems: Array<{ step: AddCopyStep; label: string }> = [
  { step: 1, label: "Member" },
  { step: 2, label: "Edition" },
  { step: 3, label: "Details" },
  { step: 4, label: "Confirm" },
];

function SelectedPill({
  icon: Icon,
  title,
  subtitle,
  onClear,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string | null;
  onClear: () => void;
}) {
  return (
    <Flex
      align="center"
      justify="between"
      gap={3}
      className="rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3"
    >
      <Flex align="center" gap={3} className="min-w-0 flex-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <Stack gap={0} className="min-w-0">
          <span className="truncate text-sm font-semibold text-foreground">
            {title}
          </span>
          {subtitle ? (
            <span className="truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </Stack>
      </Flex>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="h-8 w-8 rounded-full p-0"
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </Button>
    </Flex>
  );
}

export function AddCopyFlow({ onClose }: { onClose: () => void }) {
  const [activeStep, setActiveStep] = useState<AddCopyStep>(1);

  // Step 1 — member
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMember, setSelectedMember] =
    useState<MemberDirectoryEntry | null>(null);
  const membersQuery = useMemberDirectory();

  // Step 2 — edition
  const [bookSearch, setBookSearch] = useState("");
  const deferredBookSearch = useDeferredValue(bookSearch);
  const bookSearchQuery = useCatalogBookSearch(deferredBookSearch);
  const [selectedBook, setSelectedBook] =
    useState<PgBookWithAuthorsView | null>(null);
  const editionsQuery = useEditionsByBook(selectedBook?.id ?? null);
  const [selectedEdition, setSelectedEdition] =
    useState<CatalogEditionRecord | null>(null);

  // Step 3 — details
  const [condition, setCondition] = useState("good");
  const [shareType, setShareType] = useState("lend");
  const [notes, setNotes] = useState("");
  const [contactNote, setContactNote] = useState("");

  const [error, setError] = useState<string | null>(null);
  const createCopy = useAdminCreateCopy();

  const filteredMembers = (membersQuery.data ?? []).filter((m) => {
    if (!memberQuery.trim()) return true;
    const q = memberQuery.toLowerCase();
    return (
      m.displayName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.user_id.toLowerCase().includes(q)
    );
  });

  const canContinueMember = !!selectedMember;
  const canContinueEdition = !!selectedEdition;
  const canContinueDetails = condition.trim().length > 0;

  const canOpenStep = (step: AddCopyStep) => {
    if (step === 1) return true;
    if (step === 2) return canContinueMember;
    if (step === 3) return canContinueMember && canContinueEdition;
    return canContinueMember && canContinueEdition && canContinueDetails;
  };

  function clearBook() {
    setSelectedBook(null);
    setSelectedEdition(null);
  }

  async function handleSubmit() {
    setError(null);
    if (!selectedMember || !selectedEdition) return;

    try {
      const input: AdminCreateCopyInput = {
        userId: selectedMember.user_id,
        editionId: selectedEdition.id,
        condition,
        shareType: shareType || undefined,
        notes: notes.trim() || undefined,
        contactNote: contactNote.trim() || undefined,
      };
      await createCopy.mutateAsync(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create copy.");
    }
  }

  return (
    <Stack gap={6}>
      <FlowStepper
        items={stepItems.map((item) => ({
          step: item.step,
          label: item.label,
          current: activeStep === item.step,
          complete: activeStep > item.step,
          disabled: !canOpenStep(item.step),
          onSelect: canOpenStep(item.step)
            ? () => setActiveStep(item.step)
            : undefined,
        }))}
      />

      {/* Step 1 — Member */}
      {activeStep === 1 ? (
        <Stack gap={5}>
          <Stack gap={2}>
            <h2 className="text-lg font-semibold text-foreground">
              Select member
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Choose the member this copy will be created on behalf of.
            </p>
          </Stack>

          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Search by name, email, or user ID"
              className="pl-11"
            />
          </div>

          {membersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading members…</p>
          ) : membersQuery.isError ? (
            <p className="text-sm text-red-700">Failed to load members.</p>
          ) : filteredMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members match.</p>
          ) : (
            <SelectableList>
              {filteredMembers.slice(0, 50).map((member) => (
                <SelectableItem
                  key={member.user_id}
                  selected={selectedMember?.user_id === member.user_id}
                  onClick={() => setSelectedMember(member)}
                >
                  <Stack gap={1}>
                    <span className="font-medium text-foreground">
                      {member.displayName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </Stack>
                </SelectableItem>
              ))}
            </SelectableList>
          )}

          <Flex justify="end" className="border-t pt-5">
            <Button
              type="button"
              onClick={() => setActiveStep(2)}
              disabled={!canContinueMember}
              className="rounded-full px-5"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Flex>
        </Stack>
      ) : null}

      {/* Step 2 — Edition */}
      {activeStep === 2 ? (
        <Stack gap={5}>
          <Stack gap={2}>
            <h2 className="text-lg font-semibold text-foreground">
              Select edition
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Search for the book, then choose a specific edition.
            </p>
          </Stack>

          {selectedBook ? (
            <SelectedPill
              icon={BookOpen}
              title={selectedBook.title}
              subtitle={selectedBook.authors.map((a) => a.name).join(", ")}
              onClear={clearBook}
            />
          ) : (
            <>
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  placeholder="Search titles"
                  className="pl-11"
                />
              </div>

              {deferredBookSearch.trim().length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  Type at least 2 characters to search.
                </p>
              ) : bookSearchQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Searching…</p>
              ) : (bookSearchQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No titles found.
                </p>
              ) : (
                <SelectableList>
                  {(bookSearchQuery.data ?? []).map((book) => (
                    <SelectableItem
                      key={book.id}
                      indicator={false}
                      onClick={() => setSelectedBook(book)}
                    >
                      <Stack gap={1}>
                        <span className="font-medium text-foreground">
                          {book.title}
                        </span>
                        {book.subtitle ? (
                          <span className="text-xs text-muted-foreground">
                            {book.subtitle}
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {book.authors.map((a) => a.name).join(", ")}
                        </span>
                      </Stack>
                    </SelectableItem>
                  ))}
                </SelectableList>
              )}
            </>
          )}

          {selectedBook ? (
            <Stack gap={2}>
              <Label>Choose edition</Label>
              {editionsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading editions…
                </p>
              ) : (editionsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No editions found for this title.
                </p>
              ) : (
                <SelectableList>
                  {(editionsQuery.data ?? []).map((edition) => (
                    <SelectableItem
                      key={edition.id}
                      selected={selectedEdition?.id === edition.id}
                      onClick={() => setSelectedEdition(edition)}
                    >
                      <Stack gap={1}>
                        <Flex align="center" gap={2} wrap>
                          <Badge variant="secondary">
                            {edition.format.replace(/_/g, " ")}
                          </Badge>
                          <span className="font-medium text-foreground">
                            {edition.isbn || "No ISBN"}
                          </span>
                          {edition.published_year ? (
                            <span className="text-xs text-muted-foreground">
                              {edition.published_year}
                            </span>
                          ) : null}
                        </Flex>
                        {edition.publisher ? (
                          <span className="text-xs text-muted-foreground">
                            {edition.publisher}
                          </span>
                        ) : null}
                      </Stack>
                    </SelectableItem>
                  ))}
                </SelectableList>
              )}
            </Stack>
          ) : null}

          <Flex justify="between" wrap gap={3} className="border-t pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveStep(1)}
              className="rounded-full px-5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              onClick={() => setActiveStep(3)}
              disabled={!canContinueEdition}
              className="rounded-full px-5"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Flex>
        </Stack>
      ) : null}

      {/* Step 3 — Details */}
      {activeStep === 3 ? (
        <Stack gap={5}>
          <Stack gap={2}>
            <h2 className="text-lg font-semibold text-foreground">
              Copy details
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Set the condition and availability details for this copy.
            </p>
          </Stack>

          <div className="grid gap-4 sm:grid-cols-2">
            <Stack gap={2}>
              <Label htmlFor="copy-condition">Condition *</Label>
              <Select
                id="copy-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                <option value="new">New</option>
                <option value="like_new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </Select>
            </Stack>

            <Stack gap={2}>
              <Label htmlFor="copy-share-type">Share type</Label>
              <Select
                id="copy-share-type"
                value={shareType}
                onChange={(e) => setShareType(e.target.value)}
              >
                <option value="lend">Lend</option>
                <option value="give_away">Give away</option>
                <option value="sell">Sell</option>
              </Select>
            </Stack>

            <Stack gap={2} className="sm:col-span-2">
              <Label htmlFor="copy-notes">Notes</Label>
              <Textarea
                id="copy-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this copy"
                rows={3}
              />
            </Stack>

            <Stack gap={2} className="sm:col-span-2">
              <Label htmlFor="copy-contact-note">Contact note</Label>
              <Textarea
                id="copy-contact-note"
                value={contactNote}
                onChange={(e) => setContactNote(e.target.value)}
                placeholder="How to contact the owner (optional)"
                rows={2}
              />
            </Stack>
          </div>

          <Flex justify="between" wrap gap={3} className="border-t pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveStep(2)}
              className="rounded-full px-5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              onClick={() => setActiveStep(4)}
              disabled={!canContinueDetails}
              className="rounded-full px-5"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Flex>
        </Stack>
      ) : null}

      {/* Step 4 — Confirm */}
      {activeStep === 4 ? (
        <Stack gap={5}>
          <Stack gap={2}>
            <h2 className="text-lg font-semibold text-foreground">
              Confirm copy
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Review before the copy is created on behalf of this member.
            </p>
          </Stack>

          <div className="rounded-2xl border border-border/75 bg-card px-5 py-1">
            <FlowSummaryRow
              label="Member"
              value={selectedMember?.displayName ?? "—"}
            />
            <FlowSummaryRow
              label="Email"
              value={selectedMember?.email ?? "—"}
            />
            <FlowSummaryRow label="Book" value={selectedBook?.title ?? "—"} />
            <FlowSummaryRow
              label="Edition"
              value={
                selectedEdition ? (
                  <Flex align="center" justify="end" gap={2} wrap>
                    <Badge variant="secondary">
                      {selectedEdition.format.replace(/_/g, " ")}
                    </Badge>
                    <span>{selectedEdition.isbn || "No ISBN"}</span>
                  </Flex>
                ) : (
                  "—"
                )
              }
            />
            <FlowSummaryRow
              label="Condition"
              value={condition.replace(/_/g, " ")}
            />
            <FlowSummaryRow
              label="Share type"
              value={shareType.replace(/_/g, " ")}
            />
            {notes.trim() ? (
              <FlowSummaryRow label="Notes" value={notes.trim()} />
            ) : null}
            {contactNote.trim() ? (
              <FlowSummaryRow label="Contact note" value={contactNote.trim()} />
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <Flex justify="between" wrap gap={3} className="border-t pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveStep(3)}
              className="rounded-full px-5"
              disabled={createCopy.isPending}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={createCopy.isPending}
            >
              {createCopy.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Create copy
                </>
              )}
            </Button>
          </Flex>
        </Stack>
      ) : null}
    </Stack>
  );
}
