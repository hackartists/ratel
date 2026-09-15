import * as React from "react";
import { CrossAxisAlign, MainAxisAlign } from "./layout";

/** Dioxus `Col` (app/ratel/src/common/components/col). Same element and class string. */
export interface ColProps extends React.HTMLAttributes<HTMLDivElement> {
  mainAxisAlign?: MainAxisAlign;
  crossAxisAlign?: CrossAxisAlign;
}

export const Col = React.forwardRef<HTMLDivElement, ColProps>(
  ({ mainAxisAlign = MainAxisAlign.Start, crossAxisAlign = CrossAxisAlign.Start, className = "", ...props }, ref) => (
    <div ref={ref} className={`flex flex-col ${mainAxisAlign} ${crossAxisAlign} ${className}`} {...props} />
  ),
);
Col.displayName = "Col";
