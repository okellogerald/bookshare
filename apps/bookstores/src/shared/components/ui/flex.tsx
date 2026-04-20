import * as React from "react";
import { cn } from "@/shared/lib/utils";

const gapMap = {
  0: "gap-0",
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  5: "gap-5",
  6: "gap-6",
  8: "gap-8",
} as const;

const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
} as const;

const justifyMap = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
} as const;

interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "col";
  align?: keyof typeof alignMap;
  justify?: keyof typeof justifyMap;
  gap?: keyof typeof gapMap;
  wrap?: boolean;
  asChild?: boolean;
}

const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
  ({ className, direction = "row", align, justify, gap, wrap, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex",
        direction === "col" && "flex-col",
        align && alignMap[align],
        justify && justifyMap[justify],
        gap !== undefined && gapMap[gap],
        wrap && "flex-wrap",
        className
      )}
      {...props}
    />
  )
);
Flex.displayName = "Flex";

const Stack = React.forwardRef<HTMLDivElement, Omit<FlexProps, "direction">>(
  (props, ref) => <Flex ref={ref} direction="col" {...props} />
);
Stack.displayName = "Stack";

export { Flex, Stack };
