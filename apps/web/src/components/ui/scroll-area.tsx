import * as React from "react";
import { joinClass } from "@/lib/dom";

// app/ratel/src/common/components/scroll_area = dioxus_primitives::scroll_area.
// A div with overflow-x/overflow-y inline styles picked from direction × type,
// a visibility class, `data-scroll-direction`, and — for the Hidden type — a
// literal `scrollbar-width="none"` HTML attribute (Dioxus renders it as an
// attribute, not a style).

export const ScrollDirection = { Vertical: "vertical", Horizontal: "horizontal", Both: "both" } as const;
export type ScrollDirection = (typeof ScrollDirection)[keyof typeof ScrollDirection];

export const ScrollType = { Auto: "auto", Always: "always", Hidden: "hidden" } as const;
export type ScrollType = (typeof ScrollType)[keyof typeof ScrollType];

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: ScrollDirection;
  alwaysShowScrollbars?: boolean;
  scrollType?: ScrollType;
}

function overflow(direction: ScrollDirection, type: ScrollType): [string, string] {
  const scroll = type === ScrollType.Auto ? "auto" : "scroll";
  switch (direction) {
    case ScrollDirection.Vertical:
      return ["hidden", scroll];
    case ScrollDirection.Horizontal:
      return [scroll, "hidden"];
    default:
      return [scroll, scroll];
  }
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    { direction = ScrollDirection.Both, alwaysShowScrollbars = false, scrollType = ScrollType.Auto, className, style, ...props },
    ref,
  ) => {
    const [overflowX, overflowY] = overflow(direction, scrollType);
    const hiddenScrollbar: Record<string, string> = scrollType === ScrollType.Hidden ? { "scrollbar-width": "none" } : {};
    return (
      <div
        ref={ref}
        style={{ overflowX: overflowX as React.CSSProperties["overflowX"], overflowY: overflowY as React.CSSProperties["overflowY"], ...style }}
        {...hiddenScrollbar}
        data-scroll-direction={direction}
        {...props}
        className={joinClass(alwaysShowScrollbars ? "scroll-area-always-show" : "scroll-area-auto-hide", className)}
      />
    );
  },
);
ScrollArea.displayName = "ScrollArea";
