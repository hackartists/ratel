// packages/icons/src/icons/ratel — the icons the DAO page uses, same SVG markup
// (`stroke="currentColor"`, colored through `text-*` classes).

export interface DaoIconProps {
  width?: string;
  height?: string;
  className?: string;
}

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function CheckIcon({ width = "24", height = "24", className = "" }: DaoIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M5 13l4 4L19 7" {...STROKE} />
    </svg>
  );
}

export function XMarkIcon({ width = "24", height = "24", className = "" }: DaoIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6l12 12" {...STROKE} />
      <path d="M6 18L18 6" {...STROKE} />
    </svg>
  );
}

export function InformationCircleIcon({ width = "24", height = "24", className = "" }: DaoIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" {...STROKE} />
      <path d="M12 16v-4" {...STROKE} />
      <path d="M12 8h.01" {...STROKE} />
    </svg>
  );
}

export function ClipboardIcon({ width = "24", height = "24", className = "" }: DaoIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" {...STROKE} />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...STROKE} />
    </svg>
  );
}

export function ExternalLinkIcon({ width = "24", height = "24", className = "" }: DaoIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14" {...STROKE} />
    </svg>
  );
}
