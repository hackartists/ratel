import { useEffect, useRef, useState } from "react";

// The DID chip's copy button (credentials/views/mod.rs `HeroCard`). A click
// copies the DID and marks the button `data-copied="true"` for 1.2s, which
// swaps the copy icon for a check in main.css.

const COPIED_MS = 1200;

export function DidCopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = () => {
    const did = value.trim();
    if (!did || !navigator.clipboard) return;
    navigator.clipboard.writeText(did).catch(() => {});
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <button
      className="vc-hero__did-copy"
      aria-label={label}
      data-did-copy="true"
      data-copied={copied ? "true" : undefined}
      onClick={onClick}
    >
      <svg className="icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <svg className="icon-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}
