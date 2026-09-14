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

export function ChevronLeft(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="m15 18-6-6 6-6" />
    </LucideSvg>
  );
}

export function ChevronRight(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="m9 18 6-6-6-6" />
    </LucideSvg>
  );
}

export function ChevronDown(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="m6 9 6 6 6-6" />
    </LucideSvg>
  );
}

export function Check(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </LucideSvg>
  );
}

export function Users(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <path d="M16 3.128a4 4 0 0 1 0 7.744" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
    </LucideSvg>
  );
}

export function FileText(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </LucideSvg>
  );
}

export function Clock(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M12 6v6l4 2" />
      <circle cx="12" cy="12" r="10" />
    </LucideSvg>
  );
}

export function ListChecks(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M13 5h8" />
      <path d="M13 12h8" />
      <path d="M13 19h8" />
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
    </LucideSvg>
  );
}

export function Send(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </LucideSvg>
  );
}

export function Pencil(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </LucideSvg>
  );
}

export function RotateCcw(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </LucideSvg>
  );
}

export function Lock(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </LucideSvg>
  );
}

export function LogOut(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </LucideSvg>
  );
}

export function TriangleAlert(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </LucideSvg>
  );
}

export function Info(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </LucideSvg>
  );
}

export function Paperclip(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />
    </LucideSvg>
  );
}

export function House(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </LucideSvg>
  );
}

export function Star(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </LucideSvg>
  );
}

export function ThumbsUp(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
      <path d="M7 10v12" />
    </LucideSvg>
  );
}

export function MessageSquare(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
    </LucideSvg>
  );
}

export function Hash(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <line x1="4" x2="20" y1="9" y2="9" />
      <line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" />
      <line x1="16" x2="14" y1="3" y2="21" />
    </LucideSvg>
  );
}

export function Search(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </LucideSvg>
  );
}

export function UserPlus(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </LucideSvg>
  );
}

export function UserMinus(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </LucideSvg>
  );
}

export function User(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </LucideSvg>
  );
}

export function ShieldCheck(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </LucideSvg>
  );
}

export function Ellipsis(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </LucideSvg>
  );
}

export function Trash2(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </LucideSvg>
  );
}

export function Pin(props: LucideProps) {
  return (
    <LucideSvg {...props}>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </LucideSvg>
  );
}
