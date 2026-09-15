import type { Block, ContentBody, PostResponse, RichText } from "@ratel/ts-bridges";

// Helpers the Rust post components compute inline:
// - `PostResponse::url()` (features/posts/controllers/dto/post_response.rs:57)
// - `time_ago` (common/utils/time.rs:91)
// - `ContentBody::to_plain_text` / `to_html` (common/types/content/render.rs)
// - `convert_number_to_string` (features/posts/components/feed_card/mod.rs:7)

/** `Partition` / SubPartition wire value → the id a SubPartition renders (prefix stripped). */
export function partitionId(value: string): string {
  const hash = value.indexOf("#");
  return hash === -1 ? value : value.slice(hash + 1);
}

/**
 * `PostResponse::url()`: `Route::SpaceIndexPage { space_id }` (renders with a
 * trailing slash, `/spaces/:space_id/`) for space posts, else
 * `Route::PostDetail { post_id }` (`/posts/:post_id`).
 */
export function postUrl(post: Pick<PostResponse, "pk" | "space_pk">): string {
  if (post.space_pk) return `/spaces/${partitionId(post.space_pk)}/`;
  return `/posts/${partitionId(post.pk)}`;
}

/** `time_ago(timestamp_millis)` — integer division, like the Rust `i64` math. */
export function timeAgo(timestampMillis: number): string {
  const diff = Date.now() - timestampMillis;
  const div = (a: number, b: number) => Math.trunc(a / b);
  if (diff < 60 * 1000) return `${div(diff, 1000)}s ago`;
  if (diff < 3600 * 1000) return `${div(div(diff, 1000), 60)}m ago`;
  if (diff < 86400 * 1000) return `${div(div(diff, 1000), 3600)}h ago`;
  if (diff < 604800 * 1000) return `${div(div(diff, 1000), 86400)}d ago`;
  if (diff < 31536000 * 1000) return `${div(div(diff, 1000), 604800)}w ago`;
  return `${div(div(diff, 1000), 31536000)}y ago`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** chrono `Utc.timestamp_millis_opt(ms).format("%b %-d. %Y")`; empty when out of range. */
export function formatPostDate(timestampMillis: number): string {
  const date = new Date(timestampMillis);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}. ${date.getUTCFullYear()}`;
}

/** `convert_number_to_string` (feed_card/mod.rs:7): `1500` → `"1 K"`. */
export function convertNumberToString(n: number): string {
  const suffixes = ["K", "M", "B"];
  let value = n;
  let i = 0;
  while (value >= 1000 && i < suffixes.length) {
    value /= 1000;
    i += 1;
  }
  return i === 0 ? `${n}` : `${Math.trunc(value)} ${suffixes[i - 1]}`;
}

// ── ContentBody rendering (common/types/content/render.rs) ────────────────

export function contentToPlainText(body: ContentBody): string {
  if (body.content_type === "html_content") return normalizeWhitespace(stripTags(body.data));
  let out = "";
  for (const block of body.data.blocks) out += blockPlainText(block);
  return normalizeWhitespace(out);
}

export function contentToHtml(body: ContentBody): string {
  if (body.content_type === "html_content") return body.data;
  let out = "";
  for (const block of body.data.blocks) out += blockHtml(block);
  return out;
}

function richPlain(text: RichText): string {
  let out = "";
  for (const node of text) {
    if (node.type === "text") out += node.data.content;
    else if (node.type === "equation") out += node.data.expression;
  }
  return out;
}

function richHtml(text: RichText): string {
  let out = "";
  for (const node of text) {
    if (node.type === "text") {
      const t = node.data;
      let s = htmlEscape(t.content);
      if (t.annotations.code) s = `<code>${s}</code>`;
      if (t.annotations.bold) s = `<strong>${s}</strong>`;
      if (t.annotations.italic) s = `<em>${s}</em>`;
      if (t.annotations.strikethrough) s = `<s>${s}</s>`;
      if (t.annotations.underline) s = `<u>${s}</u>`;
      if (t.link !== null) s = `<a href="${htmlEscapeAttr(t.link)}">${s}</a>`;
      out += s;
    } else if (node.type === "equation") {
      out += `<span class="math">${htmlEscape(node.data.expression)}</span>`;
    }
  }
  return out;
}

function blockPlainText(block: Block): string {
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
      out += `${richPlain(block.data.rich_text)}\n`;
      break;
    case "equation":
      out += block.data.expression;
      break;
    case "bookmark":
      out += richPlain(block.data.caption);
      if (block.data.url !== "") out += ` ${block.data.url}`;
      break;
    case "embed":
      out += block.data.url;
      break;
    case "image":
    case "video":
    case "file":
      if (block.data.alt !== null) out += block.data.alt;
      out += richPlain(block.data.caption);
      break;
    default:
      break;
  }
  for (const child of block.children) out += blockPlainText(child);
  return out;
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
      out += `<span class="math">${htmlEscape(block.data.expression)}</span>`;
      break;
    case "image": {
      const src = block.data.source.kind === "external" ? block.data.source.url : block.data.source.asset_id;
      out += `<img src="${htmlEscapeAttr(src)}"`;
      if (block.data.alt !== null) out += ` alt="${htmlEscapeAttr(block.data.alt)}"`;
      out += " />";
      break;
    }
    case "video":
    case "file": {
      const src = block.data.source.kind === "external" ? block.data.source.url : block.data.source.asset_id;
      out += `<a href="${htmlEscapeAttr(src)}">${richHtml(block.data.caption)}</a>`;
      break;
    }
    case "bookmark":
      out += `<a href="${htmlEscapeAttr(block.data.url)}">${richHtml(block.data.caption)}</a>`;
      break;
    case "embed":
      out += `<a href="${htmlEscapeAttr(block.data.url)}">${htmlEscape(block.data.url)}</a>`;
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

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/gu, " ").trim();
}

function htmlEscape(input: string): string {
  return input.replace(/[<>&]/g, (ch) => (ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&amp;"));
}

function htmlEscapeAttr(input: string): string {
  return input.replace(/[<>&"']/g, (ch) =>
    ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === "&" ? "&amp;" : ch === '"' ? "&quot;" : "&#39;",
  );
}

// ── strip-tags 0.1.0 (PHP strip_tags), ported char-for-char ────────────────

class Chars {
  constructor(
    private readonly chars: string[],
    public pos = 0,
  ) {}
  next(): string | undefined {
    return this.chars[this.pos++];
  }
  peekIsWhitespace(): boolean {
    const c = this.chars[this.pos];
    return c !== undefined && /\s/u.test(c);
  }
  nextLowercaseMatches(expected: string): boolean {
    const got = this.chars.slice(this.pos, this.pos + expected.length).map((c) => c.toLowerCase());
    return got.join("") === expected;
  }
}

function consumeHtmlQuote(chars: Chars, quote: string) {
  for (let c = chars.next(); c !== undefined; c = chars.next()) if (c === quote) break;
}

function consumePhpQuote(chars: Chars, quote: string) {
  let last = quote;
  for (let c = chars.next(); c !== undefined; c = chars.next()) {
    if (c === quote && last !== "\\") break;
    last = c;
  }
}

function consumeParenthesis(chars: Chars) {
  let count = 1;
  for (let c = chars.next(); c !== undefined; c = chars.next()) {
    if (c === "(") count += 1;
    else if (c === ")" && count > 1) count -= 1;
    else if (c === ")") break;
  }
}

function consumePhp(chars: Chars) {
  let last = "?";
  for (let c = chars.next(); c !== undefined; c = chars.next()) {
    if (c === "(") {
      consumeParenthesis(chars);
      last = ")";
    } else if (c === ">" && last === "?") {
      break;
    } else if ((c === "'" || c === '"') && last !== "\\") {
      consumePhpQuote(chars, c);
      last = c;
    } else {
      last = c;
    }
  }
}

function consumeComment(chars: Chars) {
  for (let c = chars.next(); c !== undefined; c = chars.next()) {
    if (c === "-" && chars.nextLowercaseMatches("->")) {
      chars.next();
      chars.next();
      break;
    }
  }
}

function consumeXml(chars: Chars) {
  let last = "l";
  for (let c = chars.next(); c !== undefined; c = chars.next()) {
    if (c === ">" && last !== "-") break;
    if (c === "<") {
      consumeTag(chars);
      last = ">";
    } else if (c === "'" || c === '"') {
      consumeHtmlQuote(chars, c);
      last = c;
    } else {
      last = c;
    }
  }
}

function consumeTag(chars: Chars) {
  let last = "<";
  for (let c = chars.next(); c !== undefined; c = chars.next()) {
    if (c === ">") break;
    if (c === "<") {
      consumeTag(chars);
      last = ">";
    } else if (c === "'" || c === '"') {
      consumeHtmlQuote(chars, c);
      last = c;
    } else if (c === "?" && last === "<") {
      if (chars.nextLowercaseMatches("xml")) {
        chars.next();
        chars.next();
        chars.next();
        consumeXml(chars);
      } else {
        consumePhp(chars);
      }
      break;
    } else if (c === "!" && last === "<" && chars.nextLowercaseMatches("--")) {
      chars.next();
      chars.next();
      consumeComment(chars);
      break;
    } else {
      last = c;
    }
  }
}

function stripTags(input: string): string {
  const chars = new Chars(Array.from(input));
  let result = "";
  for (let c = chars.next(); c !== undefined; c = chars.next()) {
    if (c === "\0") continue;
    if (c === "<" && !chars.peekIsWhitespace()) consumeTag(chars);
    else result += c;
  }
  return result;
}
