import * as React from "react";
import { CrossAxisAlign, MainAxisAlign } from "./layout";

// app/ratel/src/common/components/card/mod.rs — strum strings verbatim
// (including the duplicated `bg-card-bg` in Normal).

export const CardDirection = {
  Col: "flex flex-col",
  Row: "flex flex-row",
} as const;
export type CardDirection = (typeof CardDirection)[keyof typeof CardDirection];

export const CardVariant = {
  Normal: "bg-card-bg border bg-card-bg border-card-border",
  Outlined: "border border-card-border",
  Filled: "bg-card-bg",
} as const;
export type CardVariant = (typeof CardVariant)[keyof typeof CardVariant];

export const CardShape = {
  Rounded: "rounded-[10px]",
  Squere: "rounded-0",
} as const;
export type CardShape = (typeof CardShape)[keyof typeof CardShape];

/**
 * Dioxus `Card`. Unlike the Rust component, which declares `onclick` but never
 * binds it, `onClick` is forwarded to the div like any other attribute.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  shape?: CardShape;
  direction?: CardDirection;
  mainAxisAlign?: MainAxisAlign;
  crossAxisAlign?: CrossAxisAlign;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = CardVariant.Normal,
      shape = CardShape.Rounded,
      direction = CardDirection.Col,
      mainAxisAlign = MainAxisAlign.Start,
      crossAxisAlign = CrossAxisAlign.Start,
      className = "",
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={`py-5 px-4 ${shape} ${variant} ${direction} ${mainAxisAlign} ${crossAxisAlign} ${className}`}
      {...props}
    />
  ),
);
Card.displayName = "Card";
