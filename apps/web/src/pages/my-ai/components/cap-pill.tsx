import type { ReactNode } from "react";

// component.rs `CapPill`.
export function CapPill({
  flavor,
  label,
  value,
  children,
}: {
  flavor: string;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className={`my-ai__cap my-ai__cap--${flavor}`}>
      <div className="my-ai__cap-icon">{children}</div>
      <div className="my-ai__cap-body">
        <div className="my-ai__cap-label">{label}</div>
        <div className="my-ai__cap-value">{value}</div>
      </div>
    </div>
  );
}
