import { EditorSvg, Glyph } from "./icons";

// The `.re-block` dropdown (paragraph / heading / quote / code). Rendered
// twice: in the desktop toolbar and, with `re-block--bubble`, in the selection
// bubble. Its labels are hardcoded English in the Rust component (no
// `translate!` key), so they stay English here too. `data-open`,
// `aria-expanded` and the `.re-block__label` text are rewritten by script.js
// and only ever rendered with their initial values.

const BLOCKS = [
  { block: "P", modifier: "", label: "Paragraph", hint: "P" },
  { block: "H1", modifier: " re-block__item--h1", label: "Heading 1", hint: "H1" },
  { block: "H2", modifier: " re-block__item--h2", label: "Heading 2", hint: "H2" },
  { block: "H3", modifier: " re-block__item--h3", label: "Heading 3", hint: "H3" },
  { block: "BLOCKQUOTE", modifier: " re-block__item--quote", label: "Quote", hint: '"' },
  { block: "PRE", modifier: " re-block__item--code", label: "Code block", hint: "{ }" },
] as const;

export function BlockDropdown({ bubble = false }: { bubble?: boolean }) {
  return (
    <div className={bubble ? "re-block re-block--bubble" : "re-block"} data-open="false">
      <button aria-expanded="false" aria-haspopup="listbox" className="re-block__btn" type="button">
        <span className="re-block__label">Paragraph</span>
        <EditorSvg strokeWidth="2.5">{Glyph.chevronDown}</EditorSvg>
      </button>
      <div className="re-block__menu" role="listbox">
        {BLOCKS.map((b) => (
          <button key={b.block} className={`re-block__item${b.modifier}`} data-block={b.block} type="button">
            <span>{b.label}</span>
            <span className="re-block__item-hint">{b.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
