import type { ReactNode } from "react";
import { useEditorI18n, type EditorI18n } from "@/i18n/generated/common/components/editor/editor.i18n";
import { EditorSvg, Glyph } from "./icons";

// Mobile format surface of the editor (below 980px `main.css` hides the
// toolbar and shows these): the compact `.re-mobile-bar` plus the
// `.re-fmt-sheet` bottom sheet. script.js wires everything through
// `data-cmd` / `data-block` / `data-fmt-open` / `data-fmt-close`, and owns
// `data-open`, `aria-expanded`, `aria-pressed`, `inputmode` and the
// `re-block__item--active` / `re-fmt-sheet--no-kb` classes — so all of those
// render with their initial values only and nothing here holds React state.

interface MobileBarProps {
  onInsertData?: () => void;
  insertDataLabel: string;
}

export function EditorMobileBar({ onInsertData, insertDataLabel }: MobileBarProps) {
  const tr = useEditorI18n();
  return (
    <div aria-label={tr.format} className="re-mobile-bar" role="toolbar">
      <button
        aria-expanded="false"
        aria-label={tr.format}
        className="re-mobile-bar__fmt"
        data-fmt-open="true"
        type="button"
      >
        <span className="re-mobile-bar__fmt-glyph">Aa</span>
        <span className="re-mobile-bar__fmt-label">{tr.format}</span>
      </button>
      <button aria-label={tr.image} className="re-tb-btn re-mobile-bar__btn" data-cmd="image" type="button">
        <EditorSvg>{Glyph.image}</EditorSvg>
      </button>
      <button aria-label={tr.link} className="re-tb-btn re-mobile-bar__btn" data-cmd="link" type="button">
        <EditorSvg>{Glyph.link}</EditorSvg>
      </button>
      {onInsertData && (
        <button
          aria-label={insertDataLabel}
          className="re-mobile-bar__btn re-mobile-bar__btn--insert"
          type="button"
          onClick={() => onInsertData()}
        >
          <EditorSvg strokeWidth="2.2">{Glyph.insertData}</EditorSvg>
        </button>
      )}
    </div>
  );
}

interface SheetCommand {
  cmd: string;
  label: keyof EditorI18n;
  glyph: ReactNode;
  strokeWidth?: string;
}

const BLOCK_PILLS: { block: string; modifier: string; label: keyof EditorI18n }[] = [
  { block: "P", modifier: "p", label: "body" },
  { block: "H1", modifier: "h1", label: "heading1" },
  { block: "H2", modifier: "h2", label: "heading2" },
  { block: "H3", modifier: "h3", label: "heading3" },
  { block: "BLOCKQUOTE", modifier: "quote", label: "quote" },
  { block: "PRE", modifier: "code", label: "codeBlock" },
];

const SECTIONS: { label: keyof EditorI18n; commands: SheetCommand[] }[] = [
  {
    label: "emphasis",
    commands: [
      { cmd: "bold", label: "bold", glyph: Glyph.bold, strokeWidth: "2.4" },
      { cmd: "italic", label: "italic", glyph: Glyph.italic },
      { cmd: "underline", label: "underline", glyph: Glyph.underline },
      { cmd: "strikeThrough", label: "strikethrough", glyph: Glyph.strikethrough },
      { cmd: "code-inline", label: "inlineCode", glyph: Glyph.codeInline },
    ],
  },
  {
    label: "lists",
    commands: [
      { cmd: "insertUnorderedList", label: "bulletList", glyph: Glyph.bulletList },
      { cmd: "insertOrderedList", label: "numberedList", glyph: Glyph.numberedList },
      { cmd: "outdent", label: "outdent", glyph: Glyph.outdent },
      { cmd: "indent", label: "indent", glyph: Glyph.indent },
    ],
  },
  {
    label: "alignment",
    commands: [
      { cmd: "justifyLeft", label: "alignLeft", glyph: Glyph.alignLeft },
      { cmd: "justifyCenter", label: "alignCenter", glyph: Glyph.alignCenter },
      { cmd: "justifyRight", label: "alignRight", glyph: Glyph.alignRight },
      { cmd: "justifyFull", label: "alignJustify", glyph: Glyph.alignJustify },
    ],
  },
  {
    label: "insert",
    commands: [
      { cmd: "link", label: "link", glyph: Glyph.link },
      { cmd: "unlink", label: "unlink", glyph: Glyph.unlink },
      { cmd: "image", label: "image", glyph: Glyph.image },
      { cmd: "youtube", label: "video", glyph: Glyph.youtube },
      { cmd: "table", label: "table", glyph: Glyph.table },
      { cmd: "hr", label: "divider", glyph: Glyph.hr },
    ],
  },
  { label: "clear", commands: [{ cmd: "removeFormat", label: "clearFormat", glyph: Glyph.clearFormat }] },
  // Undo/redo sit in the sheet, not the compact bar (see the Rust component).
  {
    label: "history",
    commands: [
      { cmd: "undo", label: "undo", glyph: Glyph.undo },
      { cmd: "redo", label: "redo", glyph: Glyph.redo },
    ],
  },
];

export function EditorFormatSheet() {
  const tr = useEditorI18n();
  return (
    <div className="re-fmt-sheet" data-open="false">
      <div className="re-fmt-sheet__scrim" data-fmt-close="true" />
      <div aria-label={tr.format} aria-modal="false" className="re-fmt-sheet__panel" role="dialog">
        <div className="re-fmt-sheet__grip" />
        <div className="re-fmt-sheet__head">
          <span className="re-fmt-sheet__title">{tr.format}</span>
          <button className="re-fmt-sheet__done" data-fmt-close="true" type="button">
            {tr.done}
          </button>
        </div>
        <div className="re-fmt-sheet__body">
          <div className="re-fmt-sheet__section">
            <span className="re-fmt-sheet__label">{tr.textStyle}</span>
            <div className="re-fmt-sheet__blocks">
              {BLOCK_PILLS.map((p) => (
                <button
                  key={p.block}
                  className={`re-fmt-block re-fmt-block--${p.modifier}`}
                  data-block={p.block}
                  type="button"
                >
                  {tr[p.label]}
                </button>
              ))}
            </div>
          </div>
          {SECTIONS.map((section) => (
            <div key={section.label} className="re-fmt-sheet__section">
              <span className="re-fmt-sheet__label">{tr[section.label]}</span>
              <div className="re-fmt-sheet__row">
                {section.commands.map((c) => (
                  <button
                    key={c.cmd}
                    aria-label={tr[c.label]}
                    className="re-tb-btn re-fmt-btn"
                    data-cmd={c.cmd}
                    type="button"
                  >
                    <EditorSvg strokeWidth={c.strokeWidth}>{c.glyph}</EditorSvg>
                    <span className="re-fmt-btn__label">{tr[c.label]}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
