import { cn } from "@/shared/lib/utils";

export function PageIntro({
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b border-border/70 pb-6",
        className
      )}
    >
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          {description}
        </p>
        {actions ? <div className="flex flex-wrap items-center gap-3 pt-4">{actions}</div> : null}
    </div>
  );
}
