import type { Block, ContentBody, MediaSource, RichText } from "@ratel/ts-bridges";

// Text helpers the Rust drafts views call on `PostResponse`:
//   - `ContentBody::to_plain_text` / `to_html` (common/types/content/render.rs)
//   - `strip_html` + `word_count` (draft/user/views/mod.rs:55-71)
//   - `time_ago` (common/utils/time.rs:91)
//   - `format_commas` (draft/user/views/mod.rs:73)

/** Rust integer division (truncates toward zero). */
const idiv = (a: number, b: number) => Math.trunc(a / b);

/** `common::utils::time::time_ago`. Rust hardcodes these suffixes outside translate! (time.rs:95-107). */
export function timeAgo(timestampMillis: number): string {
  const diff = Date.now() - timestampMillis;
  if (diff < 60 * 1000) return `${idiv(diff, 1000)}s ago`;
  if (diff < 3600 * 1000) return `${idiv(diff, 1000 * 60)}m ago`;
  if (diff < 86400 * 1000) return `${idiv(diff, 1000 * 3600)}h ago`;
  if (diff < 604800 * 1000) return `${idiv(diff, 1000 * 86400)}d ago`;
  if (diff < 31536000 * 1000) return `${idiv(diff, 1000 * 604800)}w ago`;
  return `${idiv(diff, 1000 * 31536000)}y ago`;
}

/** `format_commas` (draft/user/views/mod.rs:73). */
export function formatCommas(n: number): string {
  const s = String(n);
  let out = "";
  const rev = [...s].reverse();
  rev.forEach((ch, i) => {
    if (i > 0 && i % 3 === 0) out += ",";
    out += ch;
  });
  return [...out].reverse().join("");
}

/** `strip_html` of the user drafts view: drops everything between `<` and `>`. */
function stripHtmlSimple(html: string): string {
  let out = "";
  let inTag = false;
  for (const ch of html) {
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag) out += ch;
  }
  return out;
}

/** `word_count(&post.body.to_html())`. */
export function wordCount(body: ContentBody): number {
  return stripHtmlSimple(toHtml(body))
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

// ── ContentBody::to_plain_text ───────────────────────────────────────────────

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const nextIsWhitespace = (s: string, i: number) => i < s.length && /\s/.test(s[i]);
const nextLowerMatches = (s: string, i: number, expected: string) =>
  s.slice(i, i + expected.length).toLowerCase() === expected;

// Port of the `strip-tags` 0.1.0 crate (PHP `strip_tags`), index-based.
function consumeHtmlQuote(s: string, i: number, quote: string): number {
  while (i < s.length) {
    const c = s[i++];
    if (c === quote) break;
  }
  return i;
}

function consumePhpQuote(s: string, i: number, quote: string): number {
  let last = quote;
  while (i < s.length) {
    const c = s[i++];
    if (c === quote && last !== "\\") break;
    last = c;
  }
  return i;
}

function consumeParenthesis(s: string, i: number): number {
  let count = 1;
  while (i < s.length) {
    const c = s[i++];
    if (c === "(") count += 1;
    else if (c === ")" && count > 1) count -= 1;
    else if (c === ")") break;
  }
  return i;
}

function consumePhp(s: string, i: number): number {
  let last = "?";
  while (i < s.length) {
    const c = s[i++];
    if (c === "(") {
      i = consumeParenthesis(s, i);
      last = ")";
    } else if (c === ">" && last === "?") {
      break;
    } else if ((c === "'" || c === '"') && last !== "\\") {
      i = consumePhpQuote(s, i, c);
      last = c;
    } else {
      last = c;
    }
  }
  return i;
}

function consumeComment(s: string, i: number): number {
  while (i < s.length) {
    const c = s[i++];
    if (c === "-" && nextLowerMatches(s, i, "->")) {
      i += 2;
      break;
    }
  }
  return i;
}

function consumeXml(s: string, i: number): number {
  let last = "l";
  while (i < s.length) {
    const c = s[i++];
    if (c === ">" && last !== "-") break;
    if (c === "<") {
      i = consumeTag(s, i);
      last = ">";
    } else if (c === "'" || c === '"') {
      i = consumeHtmlQuote(s, i, c);
      last = c;
    } else {
      last = c;
    }
  }
  return i;
}

function consumeTag(s: string, i: number): number {
  let last = "<";
  while (i < s.length) {
    const c = s[i++];
    if (c === ">") break;
    if (c === "<") {
      i = consumeTag(s, i);
      last = ">";
    } else if (c === "'" || c === '"') {
      i = consumeHtmlQuote(s, i, c);
      last = c;
    } else if (c === "?" && last === "<") {
      if (nextLowerMatches(s, i, "xml")) i = consumeXml(s, i + 3);
      else i = consumePhp(s, i);
      break;
    } else if (c === "!" && last === "<" && nextLowerMatches(s, i, "--")) {
      i = consumeComment(s, i + 2);
      break;
    } else {
      last = c;
    }
  }
  return i;
}

function stripTags(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const c = input[i++];
    if (c === "\0") continue;
    if (c === "<" && !nextIsWhitespace(input, i)) i = consumeTag(input, i);
    else out += c;
  }
  return out;
}

function richPlain(rt: RichText): string {
  let out = "";
  for (const node of rt) {
    if (node.type === "text") out += node.data.content;
    else if (node.type === "equation") out += node.data.expression;
  }
  return out;
}

function blockPlain(block: Block): string {
  let out = "";
  switch (block.type) {
    case "paragraph":
    case "quote":
    case "bulleted_list_item":
    case "numbered_list_item":
    case "toggle":
    case "heading":
    case "todo":
    case "callout":
    case "code":
      out += richPlain(block.data.rich_text) + "\n";
      break;
    case "equation":
      out += block.data.expression;
      break;
    case "bookmark":
      out += richPlain(block.data.caption);
      if (block.data.url) out += " " + block.data.url;
      break;
    case "embed":
      out += block.data.url;
      break;
    case "image":
    case "video":
    case "file":
      if (block.data.alt != null) out += block.data.alt;
      out += richPlain(block.data.caption);
      break;
    default:
      break;
  }
  for (const child of block.children) out += blockPlain(child);
  return out;
}

/** `ContentBody::to_plain_text`. */
export function toPlainText(body: ContentBody): string {
  if (body.content_type === "html_content") return normalizeWhitespace(stripTags(body.data));
  return normalizeWhitespace(body.data.blocks.map(blockPlain).join(""));
}

// ── ContentBody::to_html ─────────────────────────────────────────────────────

const escapeHtml = (s: string) => s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
const escapeAttr = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c] as string);

function richHtml(rt: RichText): string {
  let out = "";
  for (const node of rt) {
    if (node.type === "text") {
      const t = node.data;
      let s = escapeHtml(t.content);
      if (t.annotations.code) s = `<code>${s}</code>`;
      if (t.annotations.bold) s = `<strong>${s}</strong>`;
      if (t.annotations.italic) s = `<em>${s}</em>`;
      if (t.annotations.strikethrough) s = `<s>${s}</s>`;
      if (t.annotations.underline) s = `<u>${s}</u>`;
      if (t.link != null) s = `<a href="${escapeAttr(t.link)}">${s}</a>`;
      out += s;
    } else if (node.type === "equation") {
      out += `<span class="math">${escapeHtml(node.data.expression)}</span>`;
    }
  }
  return out;
}

function mediaUrl(source: MediaSource): string {
  return source.kind === "external" ? source.url : source.asset_id;
}

function blockHtml(block: Block): string {
  let out = "";
  switch (block.type) {
    case "paragraph":
      out += `<p>${richHtml(block.data.rich_text)}</p>`;
      break;
    case "heading": {
      const tag = block.data.level;
      out += `<${tag}>${richHtml(block.data.rich_text)}</${tag}>`;
      break;
    }
    case "bulleted_list_item":
    case "numbered_list_item":
      out += `<li>${richHtml(block.data.rich_text)}</li>`;
      break;
    case "quote":
      out += `<blockquote>${richHtml(block.data.rich_text)}</blockquote>`;
      break;
    case "toggle":
      out += `<details><summary>${richHtml(block.data.rich_text)}</summary></details>`;
      break;
    case "todo":
      out += `<label><input type="checkbox" disabled ${block.data.checked ? "checked " : ""}>${richHtml(block.data.rich_text)}</label>`;
      break;
    case "code":
      out += `<pre><code>${richPlain(block.data.rich_text)}</code></pre>`;
      break;
    case "callout":
      out += `<aside>${richHtml(block.data.rich_text)}</aside>`;
      break;
    case "equation":
      out += `<span class="math">${escapeHtml(block.data.expression)}</span>`;
      break;
    case "image": {
      out += `<img src="${escapeAttr(mediaUrl(block.data.source))}"`;
      if (block.data.alt != null) out += ` alt="${escapeAttr(block.data.alt)}"`;
      out += " />";
      break;
    }
    case "video":
    case "file":
      out += `<a href="${escapeAttr(mediaUrl(block.data.source))}">${richHtml(block.data.caption)}</a>`;
      break;
    case "bookmark":
      out += `<a href="${escapeAttr(block.data.url)}">${richHtml(block.data.caption)}</a>`;
      break;
    case "embed":
      out += `<a href="${escapeAttr(block.data.url)}">${escapeHtml(block.data.url)}</a>`;
      break;
    case "divider":
      out += "<hr />";
      break;
    default:
      break;
  }
  for (const child of block.children) out += blockHtml(child);
  return out;
}

/** `ContentBody::to_html`. */
export function toHtml(body: ContentBody): string {
  if (body.content_type === "html_content") return body.data;
  return body.data.blocks.map(blockHtml).join("");
}
