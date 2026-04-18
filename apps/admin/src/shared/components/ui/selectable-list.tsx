import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const SelectableList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="listbox"
    className={cn(
      "max-h-80 overflow-y-auto rounded-2xl border border-border/75 bg-card divide-y divide-border/60",
      className
    )}
    {...props}
  />
));
SelectableList.displayName = "SelectableList";

interface SelectableItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  indicator?: boolean;
}

const SelectableItem = React.forwardRef<HTMLButtonElement, SelectableItemProps>(
  ({ className, selected, indicator = true, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        "relative flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors",
        "hover:bg-accent/60 focus-visible:bg-accent/70 focus-visible:outline-none",
        selected && "bg-primary/[0.08] hover:bg-primary/[0.1]",
        className
      )}
      {...props}
    >
      {selected ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 bg-primary"
        />
      ) : null}
      {indicator ? (
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background"
          )}
        >
          {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
);
SelectableItem.displayName = "SelectableItem";

export { SelectableList, SelectableItem };
