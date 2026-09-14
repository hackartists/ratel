// packages/icons/src/icons/upload_download — same SVG markup. Paths keep
// `stroke="black"` so `[&>path]:stroke-*` utilities recolor them (§3.2.6).

export interface IconProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Upload1({ width = "24", height = "24", className = "" }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19 15V17C19 18.1046 18.1046 19 17 19H7C5.89543 19 5 18.1046 5 17V15M12 15L12 5M12 5L14 7M12 5L10 7"
        stroke="black"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
