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

export function Bell(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
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
