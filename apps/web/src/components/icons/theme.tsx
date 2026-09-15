import * as React from "react";
import { joinClass } from "@/lib/dom";

// app/ratel/src/common/components/theme_switcher/{sun,moon,sun_moon}.rs —
// lucide markup with the same base classes; extra classes are appended.

type SvgProps = React.SVGProps<SVGSVGElement>;

function LucideSvg({ base, className, children, ...props }: SvgProps & { base: string }) {
  return (
    <svg
      className={joinClass(base, className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Sun(props: SvgProps) {
  return (
    <LucideSvg base="lucide lucide-sun-icon lucide-sun" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </LucideSvg>
  );
}

export function Moon(props: SvgProps) {
  return (
    <LucideSvg base="lucide lucide-moon-icon lucide-moon" {...props}>
      <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
    </LucideSvg>
  );
}

export function SunMoon(props: SvgProps) {
  return (
    <LucideSvg base="lucide lucide-sun-moon-icon lucide-sun-moon" {...props}>
      <path d="M12 2v2" />
      <path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715" />
      <path d="M16 12a4 4 0 0 0-4-4" />
      <path d="m19 5-1.256 1.256" />
      <path d="M20 12h2" />
    </LucideSvg>
  );
}
