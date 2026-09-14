import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { dataBool } from "@/lib/dom";
import { useLegacyScript } from "@/lib/legacy-scripts";
import editorScript from "../../../../../app/ratel/src/common/components/editor/script.js?url&no-inline";
import { EditorFormatSheet, EditorMobileBar } from "./format-sheet";
import { EditorBubble, EditorModals, EditorStatusbar, EditorTableActions } from "./overlays";
import { EditorToolbar } from "./toolbar";

// app/ratel/src/common/components/editor — the shared rich-text editor.
//
// All behaviour lives in the Dioxus editor's script.js, loaded UNMODIFIED
// (docs/superpower/2026-09-14-react-frontend-migration.md §3.4-1). It finds
// every `.ratel-editor` through a MutationObserver, binds it once
// (`data-bound`), and from then on owns the subtree's mutable state. React's
// side of the contract:
//
// - Bridges. The script reports the body HTML by assigning `.re-bridge`'s
//   `value` and dispatching a synthetic `input` event (and a JSON slash signal
//   through `.re-slash-bridge`). React's `onChange` never sees those — its
//   value tracker already holds the assigned value — so native `input`
//   listeners are attached through refs. They are attached in a layout effect,
//   i.e. during the commit and before the MutationObserver callback (a
//   microtask) can run `init()`, whose final `emitChange()` reports the
//   initial HTML.
// - Content. `.re-content` receives its initial HTML once: the
//   `dangerouslySetInnerHTML` object is pinned in state, so a re-render hands
//   React the identical string and it never rewrites the node (which would
//   reset the caret mid-IME-composition). Later `content` props are ignored;
//   remount with a `key` to replace the content, as the Rust component
//   requires.
// - Script-owned attributes (`data-bound`, `data-open`, `data-empty`,
//   `data-visible`, `aria-expanded`, …) render only as static initial values,
//   so React never has a changed value to write back over the script's.

/**
 * Caret-anchored slash-command signal (Rust `EditorSlashSignal`). An empty
 * `raw` means the slash state was cleared. Coordinates are viewport pixels;
 * `placement` is `"below"` or `"above"`.
 */
export interface EditorSlashSignal {
  raw: string;
  caretX: number;
  caretY: number;
  placement: string;
}

const CLEARED_SLASH: EditorSlashSignal = { raw: "", caretX: 0, caretY: 0, placement: "" };

/** Parses the `.re-slash-bridge` value the way the Rust `oninput` does: empty or invalid ⇒ cleared. */
function parseSlashSignal(raw: string): EditorSlashSignal {
  if (raw === "") return CLEARED_SLASH;
  try {
    const v = JSON.parse(raw) as { raw?: unknown; caret_x?: unknown; caret_y?: unknown; placement?: unknown };
    if (
      typeof v.raw !== "string" ||
      typeof v.caret_x !== "number" ||
      typeof v.caret_y !== "number" ||
      typeof v.placement !== "string"
    ) {
      return CLEARED_SLASH;
    }
    return { raw: v.raw, caretX: v.caret_x, caretY: v.caret_y, placement: v.placement };
  } catch {
    return CLEARED_SLASH;
  }
}

export interface EditorProps {
  /** Initial HTML, applied once at mount. */
  content?: string;
  editable?: boolean;
  placeholder?: string;
  /** Receives the body HTML (`""` when empty) after each debounced, IME-safe change. */
  onContentChange?: (html: string) => void;
  /** Extra class for the `.ratel-editor` root (Rust `class`). */
  className?: string;
  /** When set, the toolbar and mobile bar render an "insert data" button that calls it. */
  onInsertData?: () => void;
  insertDataLabel?: string;
  /** When set, the script watches for `/<word>` at the caret and reports each transition. */
  onSlash?: (signal: EditorSlashSignal) => void;
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Calls `handler` with the input's value on every native `input` event while mounted. */
function useNativeInput(
  ref: React.RefObject<HTMLInputElement>,
  handler: React.MutableRefObject<((value: string) => void) | undefined>,
  enabled: boolean,
) {
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const listener = () => handler.current?.(el.value);
    el.addEventListener("input", listener);
    return () => el.removeEventListener("input", listener);
  }, [enabled]);
}

export function Editor({
  content = "",
  editable = true,
  placeholder = "Type here...",
  onContentChange,
  className = "",
  onInsertData,
  insertDataLabel = "Insert data",
  onSlash,
}: EditorProps) {
  useLegacyScript(editorScript);

  const [initialHtml] = useState(() => ({ __html: content }));
  const slashEnabled = onSlash !== undefined;

  const bridgeRef = useRef<HTMLInputElement>(null);
  const slashBridgeRef = useRef<HTMLInputElement>(null);
  const changeHandler = useRef<((value: string) => void) | undefined>(undefined);
  const slashHandler = useRef<((value: string) => void) | undefined>(undefined);
  changeHandler.current = onContentChange;
  slashHandler.current = onSlash ? (value) => onSlash(parseSlashSignal(value)) : undefined;
  useNativeInput(bridgeRef, changeHandler, true);
  useNativeInput(slashBridgeRef, slashHandler, slashEnabled);

  return (
    <div
      className={`ratel-editor ${className}`}
      data-bound="false"
      data-placeholder={placeholder}
      data-editable={dataBool(editable)}
      data-slash={dataBool(slashEnabled)}
    >
      <input ref={bridgeRef} className="re-bridge" type="text" hidden aria-hidden="true" tabIndex={-1} />
      {slashEnabled && (
        <input ref={slashBridgeRef} className="re-slash-bridge" type="text" hidden aria-hidden="true" tabIndex={-1} />
      )}
      {editable && <EditorToolbar onInsertData={onInsertData} insertDataLabel={insertDataLabel} />}
      {editable && (
        <>
          <EditorMobileBar onInsertData={onInsertData} insertDataLabel={insertDataLabel} />
          <EditorFormatSheet />
        </>
      )}
      <div
        autoCapitalize="sentences"
        className="re-content"
        contentEditable={editable}
        suppressContentEditableWarning
        data-empty="true"
        spellCheck
        dangerouslySetInnerHTML={initialHtml}
      />
      {editable && (
        <>
          <EditorTableActions />
          <EditorBubble />
          <EditorStatusbar />
          <EditorModals />
        </>
      )}
    </div>
  );
}
