import { useLayoutEffect, useMemo, useRef } from "react";

const EMPTY_BLOCK = /<(p|div|li|ul|ol|h[1-6]|blockquote|span)(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi;
const LEADING_OR_TRAILING_BREAKS = /^(?:\s|&nbsp;|<br\s*\/?>)+|(?:\s|&nbsp;|<br\s*\/?>)+$/gi;

/**
 * Removes editor-produced blank blocks (`<p></p>`, `<div><br></div>`,
 * `<li><br></li>`, ...) and stray leading/trailing breaks so a clamped preview
 * never spends a line, or its ellipsis, on empty space.
 */
export function stripEmptyBlocks(html: string): string {
  let current = html;
  for (;;) {
    const next = current.replace(EMPTY_BLOCK, "");
    if (next === current) break;
    current = next;
  }
  return current.replace(LEADING_OR_TRAILING_BREAKS, "");
}

/**
 * Rich-text description preview for a quest card.
 *
 * Fills whatever height is left in `.quest-card__body` and clamps the HTML to
 * as many whole lines as fit, so the ellipsis lands at the end of the last
 * visible line. The line count is recomputed whenever the available height
 * changes. Renders nothing when the description is empty.
 */
export function QuestCardDesc({ html }: { html: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const content = useMemo(() => stripEmptyBlocks(html), [html]);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    const fit = () => {
      const lineHeight = parseFloat(getComputedStyle(text).lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
      const lines = Math.max(1, Math.floor((box.clientHeight + 0.5) / lineHeight));
      text.style.webkitLineClamp = String(lines);
    };

    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [content]);

  if (content === "") return null;

  return (
    <div ref={boxRef} className="quest-card__desc">
      <div ref={textRef} className="quest-card__desc-text" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
