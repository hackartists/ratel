import * as React from "react";
import { dataBool, joinClass } from "@/lib/dom";

// app/ratel/src/common/components/checkbox + dioxus_primitives::checkbox:
// a `button[role=checkbox]` with the indicator inside, followed by a hidden
// native checkbox for forms (a sibling — `main.css` sibling selectors rely on
// the same element order, so the component renders a fragment, no wrapper).

export const CheckboxState = {
  Checked: "checked",
  Indeterminate: "indeterminate",
  Unchecked: "unchecked",
} as const;
export type CheckboxState = (typeof CheckboxState)[keyof typeof CheckboxState];

const ARIA_CHECKED: Record<CheckboxState, "true" | "mixed" | "false"> = {
  checked: "true",
  indeterminate: "mixed",
  unchecked: "false",
};

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "defaultChecked" | "onChange"> {
  /** Controlled state; leave undefined for an uncontrolled checkbox. */
  checked?: CheckboxState;
  defaultChecked?: CheckboxState;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
  onCheckedChange?: (state: CheckboxState) => void;
}

export function Checkbox({
  checked,
  defaultChecked = CheckboxState.Unchecked,
  required = false,
  disabled = false,
  name = "",
  value = "on",
  onCheckedChange,
  className,
  onClick,
  onKeyDown,
  ...props
}: CheckboxProps) {
  const [uncontrolled, setUncontrolled] = React.useState<CheckboxState>(defaultChecked);
  const state = checked ?? uncontrolled;
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keep the hidden native input in step with the visual state.
  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.checked = state !== CheckboxState.Unchecked;
    input.indeterminate = state === CheckboxState.Indeterminate;
  }, [state]);

  const toggle = () => {
    const next = state === CheckboxState.Unchecked ? CheckboxState.Checked : CheckboxState.Unchecked;
    if (checked === undefined) setUncontrolled(next);
    onCheckedChange?.(next);
  };

  return (
    <>
      <button
        type="button"
        value={value}
        role="checkbox"
        aria-checked={ARIA_CHECKED[state]}
        aria-required={dataBool(required)}
        disabled={disabled}
        data-state={state}
        data-disabled={dataBool(disabled)}
        className={joinClass("checkbox", className)}
        onClick={(e) => {
          toggle();
          onClick?.(e);
        }}
        onKeyDown={(e) => {
          // Aria: only the space bar toggles a checkbox.
          if (e.key === "Enter") e.preventDefault();
          onKeyDown?.(e);
        }}
        {...props}
      >
        <span data-state={state} data-disabled={dataBool(disabled)} className="checkbox-indicator">
          {state !== CheckboxState.Unchecked && (
            <svg className="checkbox-check-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="checkbox"
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: "absolute", pointerEvents: "none", opacity: 0, margin: 0, transform: "translateX(-100%)" }}
        defaultChecked={defaultChecked !== CheckboxState.Unchecked}
        required={required}
        name={name}
        value={value}
        disabled={disabled}
      />
    </>
  );
}
