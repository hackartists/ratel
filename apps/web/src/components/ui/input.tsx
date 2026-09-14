import * as React from "react";

// app/ratel/src/common/components/input — strum strings verbatim.

export const InputType = {
  Text: "text",
  Email: "email",
  Number: "number",
  Password: "password",
} as const;
export type InputType = (typeof InputType)[keyof typeof InputType];

export const InputVariant = {
  Default:
    "flex px-5 w-full min-w-0 h-9 text-base font-light border outline-none md:text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none shadow-xs transition-[color,box-shadow] file:text-text-primary file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground aria-invalid:ring-destructive/20 aria-invalid:outline aria-invalid:border-c-p-50 bg-input-box-bg border-input-box-border rounded-[10px] py-5.5 text-text-primary dark:bg-input/30 dark:aria-invalid:ring-destructive/40 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]",
  Plain: "",
} as const;
export type InputVariant = (typeof InputVariant)[keyof typeof InputVariant];

/**
 * Dioxus `Input`. `onConfirm` fires on Enter and `onCancel` on Escape (both
 * prevent the default); neither fires, and `onKeyDown` isn't called, while an
 * IME composition is in progress — Korean input commits with Enter. When
 * `autoComplete` isn't "off" it also becomes the input's `name` and `id`.
 * Explicit props win over those defaults, like Dioxus attribute merging.
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  variant?: InputVariant;
  type?: InputType;
  onConfirm?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCancel?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant = InputVariant.Default,
      className = "",
      type = InputType.Text,
      autoComplete = "off",
      onConfirm,
      onCancel,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const named = autoComplete !== "off" ? { name: autoComplete, id: autoComplete } : {};
    return (
      <input
        ref={ref}
        type={type}
        className={`${variant} ${className}`}
        {...named}
        autoComplete={autoComplete}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            onConfirm?.(e);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel?.(e);
          }
          if (!e.isPropagationStopped()) onKeyDown?.(e);
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
