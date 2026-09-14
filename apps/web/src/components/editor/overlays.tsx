import type { ReactNode } from "react";
import { BlockDropdown } from "./block-menu";
import { EditorSvg } from "./icons";
import { BOLD, CODE_INLINE, ITALIC, LINK, STRIKE, ToolbarButton, UNDERLINE } from "./toolbar";

// Editable-mode surfaces rendered after `.re-content`: the table mini-toolbar,
// the selection bubble, the status bar and the link / image / YouTube / table
// modals. script.js positions and toggles them (`data-visible`,
// `data-modal` masks, `data-dragging`, counts, input values), so every
// mutable attribute renders with its initial value only. All strings here are
// hardcoded English in the Rust component and stay English.

function TableAction({
  act,
  label,
  danger = false,
  children,
}: {
  act: string;
  label: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={danger ? "re-table-actions__btn re-table-actions__btn--danger" : "re-table-actions__btn"}
      data-act={act}
      data-tip={label}
      type="button"
    >
      <EditorSvg>{children}</EditorSvg>
    </button>
  );
}

export function EditorTableActions() {
  return (
    <div aria-label="Table actions" className="re-table-actions" data-visible="false" role="toolbar">
      <TableAction act="row-above" label="Insert row above">
        <path d="M12 5v8" />
        <path d="M8 9l4-4 4 4" />
        <line x1="4" y1="17" x2="20" y2="17" />
        <line x1="4" y1="21" x2="20" y2="21" />
      </TableAction>
      <TableAction act="row-below" label="Insert row below">
        <line x1="4" y1="3" x2="20" y2="3" />
        <line x1="4" y1="7" x2="20" y2="7" />
        <path d="M12 11v8" />
        <path d="M8 15l4 4 4-4" />
      </TableAction>
      <span className="re-table-actions__sep" />
      <TableAction act="col-left" label="Insert column left">
        <path d="M13 12h8" />
        <path d="M17 8l-4 4 4 4" />
        <line x1="3" y1="4" x2="3" y2="20" />
        <line x1="7" y1="4" x2="7" y2="20" />
      </TableAction>
      <TableAction act="col-right" label="Insert column right">
        <path d="M3 12h8" />
        <path d="M7 8l4 4-4 4" />
        <line x1="17" y1="4" x2="17" y2="20" />
        <line x1="21" y1="4" x2="21" y2="20" />
      </TableAction>
      <span className="re-table-actions__sep" />
      <TableAction act="row-delete" label="Delete row">
        <line x1="4" y1="5" x2="20" y2="5" />
        <line x1="4" y1="19" x2="20" y2="19" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </TableAction>
      <TableAction act="col-delete" label="Delete column">
        <line x1="5" y1="4" x2="5" y2="20" />
        <line x1="19" y1="4" x2="19" y2="20" />
        <line x1="12" y1="8" x2="12" y2="16" />
      </TableAction>
      <span className="re-table-actions__sep" />
      <TableAction act="merge" label="Merge selected cells">
        <rect x="3" y="4" width="18" height="16" rx="1.5" />
        <path d="M8 8h8" />
        <path d="M8 16h8" />
      </TableAction>
      <TableAction act="split" label="Split merged cell">
        <rect x="3" y="4" width="18" height="16" rx="1.5" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </TableAction>
      <span className="re-table-actions__sep" />
      <TableAction act="table-delete" label="Delete table" danger>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </TableAction>
    </div>
  );
}

/** Selection-triggered floating toolbar (script.js skips it on coarse pointers). */
export function EditorBubble() {
  return (
    <div aria-label="Selection toolbar" className="re-bubble" data-visible="false" role="toolbar">
      <div className="re-bubble__inner">
        <BlockDropdown bubble />
        <div className="re-toolbar__group">
          {[BOLD, ITALIC, UNDERLINE, STRIKE, CODE_INLINE, LINK].map((c) => (
            <ToolbarButton key={c.cmd} {...c} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EditorStatusbar() {
  return (
    <div className="re-statusbar">
      <div className="re-statusbar__chips">
        <span className="re-statusbar__chip">
          {"Words "}
          <strong className="re-word-count">0</strong>
        </span>
        <span className="re-statusbar__chip">
          {"Chars "}
          <strong className="re-char-count">0</strong>
        </span>
      </div>
      <div className="re-statusbar__chip re-ime-state">composing…</div>
    </div>
  );
}

function ModalActions({ confirmClass, confirmLabel }: { confirmClass: string; confirmLabel: string }) {
  return (
    <div className="re-modal__actions">
      <button className="re-btn" data-close-modal="false" type="button">
        Cancel
      </button>
      <button className={`re-btn re-btn--primary ${confirmClass}`} type="button">
        {confirmLabel}
      </button>
    </div>
  );
}

export function EditorModals() {
  return (
    <>
      <div className="re-modal-mask" data-modal="link">
        <div aria-label="Insert link" className="re-modal" role="dialog">
          <div className="re-modal__title">Insert link</div>
          <div className="re-modal__field">
            <label>URL</label>
            <input autoComplete="off" className="re-link-url" placeholder="https://example.com" type="url" />
          </div>
          <ModalActions confirmClass="re-link-confirm" confirmLabel="Insert" />
        </div>
      </div>
      <div className="re-modal-mask" data-modal="image">
        <div aria-label="Insert image" className="re-modal" role="dialog">
          <div className="re-modal__title">Insert image</div>
          <label className="re-dropzone" data-dragging="false">
            <input className="re-image-file" accept="image/*" hidden type="file" />
            <EditorSvg className="re-dropzone__icon" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </EditorSvg>
            <div className="re-dropzone__title">Drag &amp; drop an image</div>
            <div className="re-dropzone__hint">or tap to browse — PNG, JPG, GIF, WebP</div>
          </label>
          <label className="re-camera-btn">
            <input className="re-image-camera" accept="image/*" capture="environment" hidden type="file" />
            <EditorSvg strokeWidth="1.8">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </EditorSvg>
            <span>Take a photo</span>
          </label>
          <div className="re-modal__divider">
            <span>OR PASTE A URL</span>
          </div>
          <div className="re-modal__field">
            <input className="re-image-url" placeholder="https://example.com/image.png" type="url" />
          </div>
          <ModalActions confirmClass="re-image-confirm" confirmLabel="Insert URL" />
        </div>
      </div>
      <div className="re-modal-mask" data-modal="youtube">
        <div aria-label="Embed YouTube" className="re-modal" role="dialog">
          <div className="re-modal__title">Embed YouTube video</div>
          <div className="re-modal__field">
            <label>YouTube URL or ID</label>
            <input className="re-youtube-url" placeholder="https://youtu.be/dQw4w9WgXcQ" type="text" />
          </div>
          <ModalActions confirmClass="re-youtube-confirm" confirmLabel="Embed" />
        </div>
      </div>
      <div className="re-modal-mask" data-modal="table">
        <div aria-label="Insert table" className="re-modal" role="dialog">
          <div className="table re-modal__title">Insert</div>
          <div className="re-modal__row">
            <div className="re-modal__field">
              <label>Rows</label>
              <input className="re-table-rows" max="20" min="1" type="number" defaultValue="3" />
            </div>
            <div className="re-modal__field">
              <label>Columns</label>
              <input className="re-table-cols" max="10" min="1" type="number" defaultValue="3" />
            </div>
          </div>
          <div className="re-modal__field">
            <label className="re-modal__checkbox">
              <input className="re-table-header" type="checkbox" defaultChecked={false} />
              {" First row is header\n        "}
            </label>
          </div>
          <ModalActions confirmClass="re-table-confirm" confirmLabel="Insert" />
        </div>
      </div>
    </>
  );
}
