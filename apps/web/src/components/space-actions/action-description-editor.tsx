import { useEffect, useRef, useState } from "react";

// app/ratel/src/features/spaces/pages/actions/components/action_description_editor.rs —
// description editor for the in-space action creators (discussion / quiz).
//
// Mobile (< 768px, `use_is_mobile`) renders a plain `<textarea>` whose text is
// stored as the same HTML the rich editor emits (each line wrapped in `<p>`).
// Desktop renders the shared rich-text `Editor`, which is being ported
// separately (apps/web/src/components/editor). Until it lands the desktop
// branch uses the same textarea so authoring keeps working.
//
// Snapshots `content` once at mount, like the rich editor; remount with a
// `key` to push new content in.

const MOBILE_BREAKPOINT = 768;

/** `use_is_mobile` — false on first render, then tracks `window.innerWidth < 768`. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export interface ActionDescriptionEditorProps {
  content: string;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  onContentChange?: (html: string) => void;
}

export function ActionDescriptionEditor({
  content,
  editable = true,
  placeholder = "",
  className = "",
  onContentChange,
}: ActionDescriptionEditorProps) {
  const isMobile = useIsMobile();
  const initialPlain = useRef<string | null>(null);
  if (initialPlain.current === null) initialPlain.current = htmlToTextarea(content);
  const [plain, setPlain] = useState(initialPlain.current);

  const textarea = (
    <textarea
      className={`action-desc-textarea ${className}`}
      data-testid="action-description-textarea"
      placeholder={placeholder}
      readOnly={!editable}
      value={plain}
      onChange={(e) => {
        const text = e.target.value;
        setPlain(text);
        // Store the same tagged HTML the rich editor emits.
        onContentChange?.(textareaToHtml(text));
      }}
    />
  );

  if (isMobile) return textarea;
  // editor: desktop renders `common::components::editor::Editor` (RichEditor)
  // with `class`, `content`, `editable`, `placeholder`, `on_content_change`.
  // Swap in apps/web/src/components/editor once it is ported.
  return textarea;
}

/** Editor HTML → plain text for the textarea, keeping paragraph/line breaks. */
export function htmlToTextarea(html: string): string {
  if (html.trim() === "") return "";
  let s = html;
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|h[1-6]|li|blockquote)\s*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** Textarea text → the editor's HTML shape (each line in `<p>…</p>`). */
export function textareaToHtml(text: string): string {
  if (text.trim() === "") return "";
  return text
    .split("\n")
    .map((line) => {
      const escaped = line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      return escaped.trim() === "" ? "<p></p>" : `<p>${escaped}</p>`;
    })
    .join("");
}
