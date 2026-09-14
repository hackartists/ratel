// packages/icons/src/icons/arrows — same SVG markup. Paths keep
// `stroke="black"` so `[&>path]:stroke-*` utilities recolor them (§3.2.6).

export interface IconProps {
  width?: string;
  height?: string;
  className?: string;
}

export function ArrowLeft({ width = "24", height = "24", className = "" }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 12H4M4 12L10 6M4 12L10 18"
        stroke="black"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
