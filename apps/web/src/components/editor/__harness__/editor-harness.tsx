import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Editor, type EditorSlashSignal } from "../editor";

// Playwright-only harness for the editor (playwright/tests/react/editor.spec.js).
// Mounted by the not-found page in dev builds only, at
// `/<any unknown path>?__editor_harness=1`; production builds drop the import.
//
// Query parameters mirror the Editor props so a Dioxus consumer's editor can be
// reproduced for a DOM comparison: `content`, `placeholder`, `class`,
// `editable=false`, `slash` (enables onSlash), `insertData=<label>`.
// Everything the editor reports is echoed into `data-testid` outputs, and each
// change is stored in state, so the harness re-renders on every keystroke the
// way a real consumer does.

/** Content the remount button seeds — replacing content means a new `key`. */
const REMOUNT_HTML = "<h2>Replaced</h2><p>after remount</p>";

/** The harness's own slash menu: what a consumer would render from `onSlash`. */
const SLASH_OPTIONS = [
  { id: "divider", label: "Divider", html: "<hr><p><br></p>" },
  { id: "callout", label: "Callout", html: "<blockquote>Callout</blockquote><p><br></p>" },
];

/** Replaces the `/token` before the caret with `html` (the selection survives: the menu swallows mousedown). */
function insertAtSlash(raw: string, html: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset >= raw.length) {
    range.setStart(range.startContainer, range.startOffset - raw.length);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  document.execCommand("insertHTML", false, html);
}

export default function EditorHarness() {
  const params = new URLSearchParams(useLocation().search);
  const insertDataLabel = params.get("insertData");

  const [epoch, setEpoch] = useState(0);
  const [seed, setSeed] = useState(() => params.get("content") ?? "");
  const [html, setHtml] = useState("");
  const [changes, setChanges] = useState(0);
  const [slash, setSlash] = useState<EditorSlashSignal | null>(null);
  const [slashEvents, setSlashEvents] = useState(0);
  const [insertData, setInsertData] = useState(0);

  return (
    <div data-testid="editor-harness" style={{ padding: 24 }}>
      <Editor
        key={epoch}
        content={seed}
        editable={params.get("editable") !== "false"}
        placeholder={params.get("placeholder") ?? undefined}
        className={params.get("class") ?? undefined}
        insertDataLabel={insertDataLabel ?? undefined}
        onInsertData={insertDataLabel !== null ? () => setInsertData((n) => n + 1) : undefined}
        onSlash={
          params.has("slash")
            ? (signal) => {
                setSlash(signal);
                setSlashEvents((n) => n + 1);
              }
            : undefined
        }
        onContentChange={(value) => {
          setHtml(value);
          setChanges((n) => n + 1);
        }}
      />

      {slash && slash.raw !== "" && (
        <div
          data-testid="editor-harness-slash-menu"
          data-placement={slash.placement}
          role="listbox"
          style={{ position: "fixed", left: slash.caretX, top: slash.caretY, zIndex: 1000, background: "#222" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {SLASH_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              data-testid={`editor-harness-slash-${option.id}`}
              onClick={() => insertAtSlash(slash.raw, option.html)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        data-testid="editor-harness-remount"
        onClick={() => {
          setSeed(REMOUNT_HTML);
          setEpoch((n) => n + 1);
        }}
      >
        remount
      </button>
      {/* Wrapped: an unbroken HTML line would widen the page, and on a mobile
          viewport Chrome then zooms out, which the viewport tracker reads as
          an open keyboard (`--kb-inset`) and pushes the format sheet away. */}
      <pre data-testid="editor-harness-html" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {html}
      </pre>
      <output data-testid="editor-harness-changes">{changes}</output>
      <output data-testid="editor-harness-slash">{slash ? JSON.stringify(slash) : ""}</output>
      <output data-testid="editor-harness-slash-events">{slashEvents}</output>
      <output data-testid="editor-harness-insert-data">{insertData}</output>
    </div>
  );
}
