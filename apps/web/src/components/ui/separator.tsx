import * as React from "react";
import { joinClass } from "@/lib/dom";

// app/ratel/src/common/components/separator + dioxus_primitives::separator.

export const SeparatorVariant = {
  Solid: "border-solid",
  Dashed: "border-dashed",
} as const;
export type SeparatorVariant = (typeof SeparatorVariant)[keyof typeof SeparatorVariant];

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SeparatorVariant;
  /** Horizontal if true, vertical if false. */
  horizontal?: boolean;
  /** Decorative separators get `role="none"` and no `aria-orientation`. */
  decorative?: boolean;
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ variant = SeparatorVariant.Solid, horizontal = true, decorative = false, className, ...props }, ref) => {
    const orientation = horizontal ? "horizontal" : "vertical";
    return (
      <div
        ref={ref}
        role={decorative ? "none" : "separator"}
        aria-orientation={decorative ? undefined : orientation}
        data-orientation={orientation}
        className={joinClass(`separator ${variant}`, className)}
        {...props}
      />
    );
  },
);
Separator.displayName = "Separator";
