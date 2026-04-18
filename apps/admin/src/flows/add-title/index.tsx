"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { FlowStepper } from "@/shared/components/flow-stepper";
import {
  type AuthorRecord,
  type CreateBookInput,
  useCreateBook,
} from "@/domain/catalog/queries";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { FlowSummaryRow } from "@/shared/components/flow-summary-row";
import { AuthorPicker } from "@/flows/add-edition/author-picker";

type AddTitleStep = 1 | 2 | 3;

const stepItems: Array<{ step: AddTitleStep; label: string }> = [
  { step: 1, label: "Title" },
  { step: 2, label: "Authors" },
  { step: 3, label: "Confirm" },
];

export function AddTitleFlow({ onClose }: { onClose: () => void }) {
  const [activeStep, setActiveStep] = useState<AddTitleStep>(1);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [authors, setAuthors] = useState<AuthorRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const createBook = useCreateBook();

  const canContinueTitleStep = title.trim().length > 0;
  const canContinueAuthorsStep = authors.length > 0;

  const canOpenStep = (step: AddTitleStep) => {
    if (step === 1) return true;
    if (step === 2) return canContinueTitleStep;
    return canContinueTitleStep && canContinueAuthorsStep;
  };

  async function handleSubmit() {
    setError(null);

    try {
      const input: CreateBookInput = {
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        language: language.trim() || "en",
        authorIds: authors.map((a) => a.id),
      };
      await createBook.mutateAsync(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save title.");
    }
  }

  return (
    <div className="space-y-6">
      <FlowStepper
        items={stepItems.map((item) => ({
          step: item.step,
          label: item.label,
          current: activeStep === item.step,
          complete: activeStep > item.step,
          disabled: !canOpenStep(item.step),
          onSelect: canOpenStep(item.step) ? () => setActiveStep(item.step) : undefined,
        }))}
      />

      {activeStep === 1 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Title details</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Enter the title, optional subtitle, and language for this book record.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title-title">Title *</Label>
              <Input
                id="title-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Things Fall Apart"
                maxLength={500}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title-subtitle">Subtitle</Label>
              <Input
                id="title-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Optional subtitle"
                maxLength={1000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title-language">Language</Label>
              <Input
                id="title-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en"
                maxLength={10}
              />
            </div>
          </div>

          <div className="flex justify-end border-t pt-5">
            <Button
              type="button"
              onClick={() => setActiveStep(2)}
              disabled={!canContinueTitleStep}
              className="rounded-full px-5"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {activeStep === 2 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Add authors</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              At least one author is required before the title can be saved.
            </p>
          </div>

          <AuthorPicker selected={authors} onChange={setAuthors} />

          <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
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
              disabled={!canContinueAuthorsStep}
              className="rounded-full px-5"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {activeStep === 3 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Confirm title</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Review the details before the record is created.
            </p>
          </div>

          <div className="rounded-2xl border border-border/75 bg-card px-5 py-1">
            <FlowSummaryRow label="Title" value={title.trim() || "—"} />
            {subtitle.trim() ? <FlowSummaryRow label="Subtitle" value={subtitle.trim()} /> : null}
            <FlowSummaryRow label="Language" value={language.trim() || "en"} />
            <FlowSummaryRow
              label="Authors"
              value={authors.length > 0 ? authors.map((a) => a.name).join(", ") : "No authors"}
            />
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveStep(2)}
              className="rounded-full px-5"
              disabled={createBook.isPending}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={createBook.isPending}
            >
              {createBook.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Create title
                </>
              )}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
