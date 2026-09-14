import * as React from "react";
import { CrossAxisAlign, MainAxisAlign } from "./layout";

/** Dioxus `Row` (app/ratel/src/common/components/row). Same element and class string. */
export interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
  mainAxisAlign?: MainAxisAlign;
  crossAxisAlign?: CrossAxisAlign;
}

export const Row = React.forwardRef<HTMLDivElement, RowProps>(
  ({ mainAxisAlign = MainAxisAlign.Start, crossAxisAlign = CrossAxisAlign.Start, className = "", ...props }, ref) => (
    <div ref={ref} className={`flex flex-row ${mainAxisAlign} ${crossAxisAlign} ${className}`} {...props} />
  ),
);
Row.displayName = "Row";
