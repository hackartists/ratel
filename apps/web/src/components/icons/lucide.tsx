import * as React from "react";

// lucide_dioxus icons (lucide-dioxus 2.569.0) — same attributes and defaults:
// size 24, stroke currentColor, fill none, stroke-width 2; `class` only when given.

export interface LucideProps {
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

function LucideSvg({
  size = 24,
  color = "currentColor",
  fill = "none",
  strokeWidth = 2,
  className,
  style,
  children,
}: LucideProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function Plus(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </LucideSvg>
  );
}

export function X(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </LucideSvg>
  );
}
