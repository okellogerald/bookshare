import * as React from "react";
import { cn } from "@/shared/lib/utils";

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "relative w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground",
        className
      )}
      {...props}
    />
  )
);
Alert.displayName = "Alert";

export { Alert };

