import type { ReactNode } from "react";

// SVG glyphs of app/ratel/src/common/components/editor/component.rs. Every
// editor icon is a 24×24 stroked outline; the stroke width varies per use
// (bold 2.4, block chevron 2.5, insert-data 2.2), so it is passed per call
// site exactly as the Rust markup has it. Child elements and their attribute
// values are copied verbatim.

export function EditorSvg({
  strokeWidth = "2",
  className,
  children,
}: {
  strokeWidth?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

export const Glyph = {
  undo: (
    <>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
    </>
  ),
  redo: (
    <>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 15-6.7L21 13" />
    </>
  ),
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  bold: (
    <>
      <path d="M6 4h8a4 4 0 0 1 0 8H6z" />
      <path d="M6 12h9a4 4 0 0 1 0 8H6z" />
    </>
  ),
  italic: (
    <>
      <line x1="19" x2="10" y1="4" y2="4" />
      <line x1="14" x2="5" y1="20" y2="20" />
      <line x1="15" x2="9" y1="4" y2="20" />
    </>
  ),
  underline: (
    <>
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <line x1="4" x2="20" y1="20" y2="20" />
    </>
  ),
  strikethrough: (
    <>
      <line x1="4" x2="20" y1="12" y2="12" />
      <path d="M16 6c-1.5-1.3-3.5-2-6-2-3 0-5 1.5-5 4 0 2 1.5 3 5 4" />
      <path d="M8 18c1.5 1.3 3.5 2 6 2 3 0 5-1.5 5-4 0-1-.4-1.8-1-2.4" />
    </>
  ),
  codeInline: (
    <>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </>
  ),
  alignLeft: (
    <>
      <line x1="17" x2="3" y1="10" y2="10" />
      <line x1="21" x2="3" y1="6" y2="6" />
      <line x1="21" x2="3" y1="14" y2="14" />
      <line x1="17" x2="3" y1="18" y2="18" />
    </>
  ),
  alignCenter: (
    <>
      <line x1="18" x2="6" y1="10" y2="10" />
      <line x1="21" x2="3" y1="6" y2="6" />
      <line x1="21" x2="3" y1="14" y2="14" />
      <line x1="18" x2="6" y1="18" y2="18" />
    </>
  ),
  alignRight: (
    <>
      <line x1="21" x2="7" y1="10" y2="10" />
      <line x1="21" x2="3" y1="6" y2="6" />
      <line x1="21" x2="3" y1="14" y2="14" />
      <line x1="21" x2="7" y1="18" y2="18" />
    </>
  ),
  alignJustify: (
    <>
      <line x1="21" x2="3" y1="10" y2="10" />
      <line x1="21" x2="3" y1="6" y2="6" />
      <line x1="21" x2="3" y1="14" y2="14" />
      <line x1="21" x2="3" y1="18" y2="18" />
    </>
  ),
  bulletList: (
    <>
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>
  ),
  numberedList: (
    <>
      <line x1="10" x2="21" y1="6" y2="6" />
      <line x1="10" x2="21" y1="12" y2="12" />
      <line x1="10" x2="21" y1="18" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </>
  ),
  outdent: (
    <>
      <line x1="21" x2="3" y1="5" y2="5" />
      <line x1="21" x2="3" y1="19" y2="19" />
      <line x1="21" x2="11" y1="9" y2="9" />
      <line x1="21" x2="11" y1="15" y2="15" />
      <polyline points="7 9 3 12 7 15" />
    </>
  ),
  indent: (
    <>
      <line x1="3" x2="21" y1="5" y2="5" />
      <line x1="3" x2="21" y1="19" y2="19" />
      <line x1="13" x2="3" y1="9" y2="9" />
      <line x1="13" x2="3" y1="15" y2="15" />
      <polyline points="17 9 21 12 17 15" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  unlink: (
    <>
      <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M5.16 11.75L3.44 13.46a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </>
  ),
  image: (
    <>
      <rect height="18" rx="2" width="18" x="3" y="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </>
  ),
  youtube: (
    <>
      <path d="M22 8.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v7a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4z" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </>
  ),
  table: (
    <>
      <rect height="18" rx="2" width="18" x="3" y="3" />
      <line x1="3" x2="21" y1="9" y2="9" />
      <line x1="3" x2="21" y1="15" y2="15" />
      <line x1="9" x2="9" y1="3" y2="21" />
      <line x1="15" x2="15" y1="3" y2="21" />
    </>
  ),
  hr: <line x1="4" x2="20" y1="12" y2="12" />,
  clearFormat: (
    <>
      <path d="M4 7V4h16v3" />
      <line x1="5" x2="11" y1="20" y2="20" />
      <line x1="13" x2="8" y1="4" y2="20" />
      <line x1="3" x2="21" y1="3" y2="21" />
    </>
  ),
  insertData: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
} as const;
