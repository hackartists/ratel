import { useMemo } from "react";

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
 * Renders the sanitized HTML clamped to a fixed seven lines so the ellipsis
 * lands at the end of the last visible line. Renders nothing when the
 * description is empty.
 */
export function QuestCardDesc({ html }: { html: string }) {
  const content = useMemo(() => stripEmptyBlocks(html), [html]);

  if (content === "") return null;

  return <div className="quest-card__desc" dangerouslySetInnerHTML={{ __html: content }} />;
}
