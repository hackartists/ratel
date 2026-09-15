import * as React from "react";

// app/ratel/src/common/components/switch — same element, role and class strings.
// `shrink-0` keeps the fixed-size control from collapsing next to long labels.
const CONTAINER_DISABLED =
  "relative inline-flex items-center shrink-0 w-11 h-6 rounded-full transition-colors bg-switch-track opacity-40 cursor-not-allowed";
const CONTAINER_ACTIVE =
  "relative inline-flex items-center shrink-0 w-11 h-6 rounded-full transition-colors bg-primary cursor-pointer";
const CONTAINER_INACTIVE =
  "relative inline-flex items-center shrink-0 w-11 h-6 rounded-full transition-colors bg-switch-track cursor-pointer";
const KNOB_ON =
  "absolute left-[2px] top-[2px] w-5 h-5 rounded-full bg-switch-knob transition-transform translate-x-5";
const KNOB_OFF = "absolute left-[2px] top-[2px] w-5 h-5 rounded-full bg-switch-knob transition-transform";

export interface SwitchProps {
  active: boolean;
  onToggle: React.MouseEventHandler<HTMLButtonElement>;
  /** Accessible name (`aria-label`); omitted when empty, like Dioxus. */
  label?: string;
  disabled?: boolean;
}

export function Switch({ active, onToggle, label = "", disabled = false }: SwitchProps) {
  const containerClass = disabled ? CONTAINER_DISABLED : active ? CONTAINER_ACTIVE : CONTAINER_INACTIVE;
  return (
    <button
      type="button"
      className={containerClass}
      role="switch"
      aria-checked={active ? "true" : "false"}
      aria-label={label === "" ? undefined : label}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className={active && !disabled ? KNOB_ON : KNOB_OFF} />
    </button>
  );
}
