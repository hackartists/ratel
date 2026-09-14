import * as React from "react";
import { LoadingIndicator } from "./loading-indicator";

// app/ratel/src/common/components/button — strum strings verbatim.

export const ButtonShape = {
  Rounded: "rounded-full",
  Square: "rounded-lg",
} as const;
export type ButtonShape = (typeof ButtonShape)[keyof typeof ButtonShape];

export const ButtonSize = {
  Medium: "py-3 px-5 text-[14px]/[16px] font-bold",
  Inline: "py-0 px-0 text-[15px]/[24px] font-medium",
  Icon: "p-1 text-[14px]/[14px] font-medium",
  Small: "py-1.5 px-3 text-[13px]/[16px] font-semibold",
} as const;
export type ButtonSize = (typeof ButtonSize)[keyof typeof ButtonSize];

export const ButtonStyle = {
  Primary:
    "bg-btn-primary-bg border-btn-primary-outline text-btn-primary-text hover:bg-btn-primary-hover-bg hover:border-btn-primary-hover-outline hover:text-btn-primary-hover-text disabled:bg-btn-primary-disable-bg disabled:border-btn-primary-disable-outline disabled:text-btn-primary-disable-text",
  Secondary:
    "bg-btn-secondary-bg border-btn-secondary-outline text-btn-secondary-text hover:bg-btn-secondary-hover-bg hover:border-btn-secondary-hover-outline hover:text-btn-secondary-hover-text disabled:bg-btn-secondary-disable-bg disabled:border-btn-secondary-disable-outline disabled:text-btn-secondary-disable-text",
  Outline:
    "bg-btn-outline-bg border-btn-outline-outline text-btn-outline-text hover:bg-btn-outline-hover-bg hover:border-btn-outline-hover-outline hover:text-btn-outline-hover-text disabled:bg-btn-outline-disable-bg disabled:border-btn-outline-disable-outline disabled:text-btn-outline-disable-text border",
  Text: "bg-transparent border-transparent text-text-primary hover:bg-hover disabled:bg-transparent disabled:border-transparent disabled:text-text-secondary",
} as const;
export type ButtonStyle = (typeof ButtonStyle)[keyof typeof ButtonStyle];

/**
 * Dioxus `Button`. `buttonStyle` is the Rust `style` prop (React reserves
 * `style` for inline styles). While `loading`, the button is disabled and
 * shows the loading animation instead of its children.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  buttonStyle?: ButtonStyle;
  shape?: ButtonShape;
  loading?: boolean;
  loadingClassName?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      size = ButtonSize.Medium,
      buttonStyle = ButtonStyle.Primary,
      shape = ButtonShape.Rounded,
      disabled = false,
      loading = false,
      loadingClassName = "w-auto h-auto grow-0 max-w-4",
      onClick,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      className={`${size} ${buttonStyle} ${shape} ${className}`}
      disabled={disabled || loading}
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
      }}
      {...props}
    >
      {loading ? <LoadingIndicator className={loadingClassName} maxWidth="32px" /> : children}
    </button>
  ),
);
Button.displayName = "Button";
