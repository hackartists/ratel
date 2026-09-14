// app/ratel/src/common/utils/mention.rs — mention markup:
//   @[display_name](user:PARTITION_KEY)
// Used by the discussion arena composer/comment renderer (mention
// autocomplete insert + rendered `@name` highlighting) and by
// `MentionAutocomplete` (`components/ui/mention-autocomplete.tsx`) for
// priority ranking.

export type ContentSegment = { kind: "text"; text: string } | { kind: "mention"; displayName: string; userPk: string };

function tryParseMention(content: string, start: number): { displayName: string; userPk: string; end: number } | null {
  const rest = content.slice(start);
  if (!rest.startsWith("@[")) return null;
  const closeBracket = rest.indexOf("]");
  if (closeBracket === -1) return null;
  const displayName = rest.slice(2, closeBracket);
  if (displayName === "") return null;
  const afterBracket = rest.slice(closeBracket + 1);
  if (!afterBracket.startsWith("(user:")) return null;
  const closeParen = afterBracket.indexOf(")");
  if (closeParen === -1) return null;
  const userPk = afterBracket.slice(6, closeParen);
  if (userPk === "") return null;
  const totalLen = closeBracket + 1 + closeParen + 1;
  return { displayName, userPk, end: start + totalLen };
}

/** Rust `parse_mention_segments`. */
export function parseMentionSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastEnd = 0;
  let i = 0;
  while (i < content.length) {
    if (content[i] === "@" && content[i + 1] === "[") {
      const parsed = tryParseMention(content, i);
      if (parsed) {
        if (i > lastEnd) segments.push({ kind: "text", text: content.slice(lastEnd, i) });
        segments.push({ kind: "mention", displayName: parsed.displayName, userPk: parsed.userPk });
        lastEnd = parsed.end;
        i = parsed.end;
        continue;
      }
    }
    i += 1;
  }
  if (lastEnd < content.length) segments.push({ kind: "text", text: content.slice(lastEnd) });
  return segments;
}

/** Rust `extract_mentioned_pks`. */
export function extractMentionedPks(content: string): string[] {
  const pks: string[] = [];
  for (const seg of parseMentionSegments(content)) {
    if (seg.kind === "mention" && !pks.includes(seg.userPk)) pks.push(seg.userPk);
  }
  return pks;
}

/**
 * Rust `build_mention_priority`: earlier entries rank higher. Order is
 * primary comment author, then thread authors (caller orders newest-first),
 * then anyone mentioned in the primary, then anyone mentioned in the thread.
 * Duplicates drop to their first occurrence so authors always outrank their
 * own mentions.
 */
export function buildMentionPriority(primary: [string, string] | null, thread: [string, string][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (pk: string) => {
    if (pk !== "" && !seen.has(pk)) {
      seen.add(pk);
      out.push(pk);
    }
  };
  if (primary) push(primary[0]);
  for (const [author] of thread) push(author);
  if (primary) for (const pk of extractMentionedPks(primary[1])) push(pk);
  for (const [, content] of thread) for (const pk of extractMentionedPks(content)) push(pk);
  return out;
}

/** Rust `strip_mention_markup`. */
export function stripMentionMarkup(content: string): string {
  let result = "";
  for (const seg of parseMentionSegments(content)) {
    result += seg.kind === "text" ? seg.text : `@${seg.displayName}`;
  }
  return result;
}

/** Rust `mention_display` — text inserted into the textarea (visible to user). */
export function mentionDisplay(displayName: string): string {
  return `@${displayName} `;
}

/**
 * Rust `apply_mention_markup` — convert display text back to markup before
 * submission, replacing each `@display_name` occurrence (first match only,
 * per tracked mention) with `@[display_name](user:pk)`.
 */
export function applyMentionMarkup(displayText: string, mentions: [string, string][]): string {
  let result = displayText;
  for (const [displayName, userPk] of mentions) {
    const displayPattern = `@${displayName}`;
    const markup = `@[${displayName}](user:${userPk})`;
    const idx = result.indexOf(displayPattern);
    if (idx !== -1) {
      result = result.slice(0, idx) + markup + result.slice(idx + displayPattern.length);
    }
  }
  return result;
}
