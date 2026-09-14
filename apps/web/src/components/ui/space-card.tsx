import * as React from "react";

// app/ratel/src/common/components/space_card — same element and class string.

const BASE = "w-full rounded-2xl max-mobile:rounded-xl bg-web-card-bg p-[30px] max-tablet:p-5 max-mobile:p-4";

export interface SpaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `h-full min-h-0` instead of `h-auto`. */
  fillHeight?: boolean;
}

export const SpaceCard = React.forwardRef<HTMLDivElement, SpaceCardProps>(
  ({ fillHeight = false, className, ...props }, ref) => {
    const base = `${fillHeight ? "h-full min-h-0" : "h-auto"} ${BASE}`;
    return <div ref={ref} className={className ? `${base} ${className}` : base} {...props} />;
  },
);
SpaceCard.displayName = "SpaceCard";
