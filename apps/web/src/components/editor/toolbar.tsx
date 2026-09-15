import type { ReactNode } from "react";
import { BlockDropdown } from "./block-menu";
import { EditorSvg, Glyph } from "./icons";

// Desktop `.re-toolbar` of the editor. script.js binds every `.re-tb-btn` by
// its `data-cmd` and owns `aria-pressed`, so these buttons carry no React
// handlers (except the consumer's insert-data button, which has no
// `data-cmd`). Labels and tooltips are hardcoded English in the Rust
// component and stay English here.

export interface ToolbarCommand {
  cmd: string;
  label: string;
  glyph: ReactNode;
  strokeWidth?: string;
}

/** `button.re-tb-btn` with `data-cmd` + `data-tip`, as in the toolbar and the bubble. */
export function ToolbarButton({ cmd, label, glyph, strokeWidth }: ToolbarCommand) {
  return (
    <button aria-label={label} className="re-tb-btn" data-cmd={cmd} data-tip={label} type="button">
      <EditorSvg strokeWidth={strokeWidth}>{glyph}</EditorSvg>
    </button>
  );
}

function Group({ commands }: { commands: ToolbarCommand[] }) {
  return (
    <div className="re-toolbar__group">
      {commands.map((c) => (
        <ToolbarButton key={c.cmd} {...c} />
      ))}
    </div>
  );
}

export const BOLD: ToolbarCommand = { cmd: "bold", label: "Bold", glyph: Glyph.bold, strokeWidth: "2.4" };
export const ITALIC: ToolbarCommand = { cmd: "italic", label: "Italic", glyph: Glyph.italic };
export const UNDERLINE: ToolbarCommand = { cmd: "underline", label: "Underline", glyph: Glyph.underline };
export const STRIKE: ToolbarCommand = { cmd: "strikeThrough", label: "Strikethrough", glyph: Glyph.strikethrough };
export const CODE_INLINE: ToolbarCommand = { cmd: "code-inline", label: "Inline code", glyph: Glyph.codeInline };
export const LINK: ToolbarCommand = { cmd: "link", label: "Insert link", glyph: Glyph.link };

const HISTORY: ToolbarCommand[] = [
  { cmd: "undo", label: "Undo", glyph: Glyph.undo },
  { cmd: "redo", label: "Redo", glyph: Glyph.redo },
];
const INLINE: ToolbarCommand[] = [BOLD, ITALIC, UNDERLINE, STRIKE, CODE_INLINE];
const ALIGN: ToolbarCommand[] = [
  { cmd: "justifyLeft", label: "Align left", glyph: Glyph.alignLeft },
  { cmd: "justifyCenter", label: "Align center", glyph: Glyph.alignCenter },
  { cmd: "justifyRight", label: "Align right", glyph: Glyph.alignRight },
  { cmd: "justifyFull", label: "Justify", glyph: Glyph.alignJustify },
];
const LISTS: ToolbarCommand[] = [
  { cmd: "insertUnorderedList", label: "Bullet list", glyph: Glyph.bulletList },
  { cmd: "insertOrderedList", label: "Numbered list", glyph: Glyph.numberedList },
  { cmd: "outdent", label: "Outdent", glyph: Glyph.outdent },
  { cmd: "indent", label: "Indent", glyph: Glyph.indent },
];
const INSERT: ToolbarCommand[] = [
  LINK,
  { cmd: "unlink", label: "Remove link", glyph: Glyph.unlink },
  { cmd: "image", label: "Insert image", glyph: Glyph.image },
  { cmd: "youtube", label: "Embed YouTube", glyph: Glyph.youtube },
  { cmd: "table", label: "Insert table", glyph: Glyph.table },
  { cmd: "hr", label: "Horizontal rule", glyph: Glyph.hr },
];
const CLEAR: ToolbarCommand[] = [{ cmd: "removeFormat", label: "Clear formatting", glyph: Glyph.clearFormat }];

export interface EditorToolbarProps {
  onInsertData?: () => void;
  insertDataLabel: string;
}

export function EditorToolbar({ onInsertData, insertDataLabel }: EditorToolbarProps) {
  return (
    <div aria-label="Editor toolbar" className="re-toolbar" role="toolbar">
      <Group commands={HISTORY} />
      <div className="re-toolbar__group">
        <BlockDropdown />
      </div>
      <Group commands={INLINE} />
      <Group commands={ALIGN} />
      <Group commands={LISTS} />
      <Group commands={INSERT} />
      <Group commands={CLEAR} />
      {onInsertData && (
        <div className="re-toolbar__group re-toolbar__group--insert">
          <button
            aria-label={insertDataLabel}
            className="re-tb-btn re-tb-btn--insert-data"
            data-tip={insertDataLabel}
            type="button"
            onClick={() => onInsertData()}
          >
            <EditorSvg strokeWidth="2.2">{Glyph.insertData}</EditorSvg>
            <span>{insertDataLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}
