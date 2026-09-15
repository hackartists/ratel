import * as React from "react";

// app/ratel/src/common/components/badge — strum strings verbatim. `Default`
// has no `serialize`, so strum's Display renders the variant name itself.

export const BadgeColor = {
  Grey: "text-badge-grey bg-badge-grey/20 border-badge-grey/30",
  Blue: "text-badge-blue bg-badge-blue/20 border-badge-blue/30",
  Green: "text-badge-green bg-badge-green/20 border-badge-green/30",
  Orange: "text-badge-orange bg-badge-orange/20 border-badge-orange/30",
  Pink: "text-badge-pink bg-badge-pink/20 border-badge-pink/30",
  Purple: "text-badge-purple bg-badge-purple/20 border-badge-purple/30",
  Red: "text-badge-red bg-badge-red/20 border-badge-red/30",
} as const;
export type BadgeColor = (typeof BadgeColor)[keyof typeof BadgeColor];

export const BadgeSize = {
  Normal: "px-[13px] py-[7px] text-[12px]/[16px] font-semibold",
  Small: "py-1 px-2 text-[12px] font-semibold",
} as const;
export type BadgeSize = (typeof BadgeSize)[keyof typeof BadgeSize];

export const BadgeVariant = {
  Default: "Default",
  Rounded: "rounded-full border",
} as const;
export type BadgeVariant = (typeof BadgeVariant)[keyof typeof BadgeVariant];

/** Dioxus `Badge`. The Rust component has no `class` prop; a passed class is appended like Dioxus merges it. */
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: BadgeColor;
  size?: BadgeSize;
  variant?: BadgeVariant;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ color = BadgeColor.Grey, size = BadgeSize.Normal, variant = BadgeVariant.Default, className, ...props }, ref) => (
    <div ref={ref} className={`${color} ${size} ${variant}${className ? ` ${className}` : ""}`} {...props} />
  ),
);
Badge.displayName = "Badge";
