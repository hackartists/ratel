import type { Block, ContentBody, ContentDocument, RichText } from "@ratel/ts-bridges";

// app/ratel/src/common/types/content/render.rs `ContentBody::to_plain_text`
// (the post-card preview text).

export function contentToPlainText(body: ContentBody): string {
  return body.content_type === "html_content" ? stripHtmlTags(body.data) : documentToPlainText(body.data);
}

/** render.rs `ContentDocument::to_plain_text`. */
function documentToPlainText(doc: ContentDocument): string {
  const out: string[] = [];
  for (const block of doc.blocks) appendBlock(block, out);
  return normalizeWhitespace(out.join(""));
}

/** render.rs `Block::append_plain_text`. */
function appendBlock(block: Block, out: string[]) {
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
      appendRichText(block.data.rich_text, out);
      out.push("\n");
      break;
    case "equation":
      out.push(block.data.expression);
      break;
    case "bookmark":
      appendRichText(block.data.caption, out);
      if (block.data.url !== "") {
        out.push(" ");
        out.push(block.data.url);
      }
      break;
    case "embed":
      out.push(block.data.url);
      break;
    case "image":
    case "video":
    case "file":
      if (block.data.alt !== null) out.push(block.data.alt);
      appendRichText(block.data.caption, out);
      break;
    case "divider":
    case "custom":
    case "unknown":
      break;
  }
  for (const child of block.children) appendBlock(child, out);
}

/** render.rs `RichText::append_plain`. */
function appendRichText(text: RichText, out: string[]) {
  for (const node of text) {
    if (node.type === "text") out.push(node.data.content);
    else if (node.type === "equation") out.push(node.data.expression);
  }
}

/** render.rs `strip_html_tags`: `strip_tags::strip_tags` + `normalize_whitespace`. */
function stripHtmlTags(html: string): string {
  return normalizeWhitespace(stripTags(html));
}

/** render.rs `normalize_whitespace`: `\s+` → " ", then trim. */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/gu, " ").trim();
}

// ── strip-tags 0.1.0 (`strip_tags::strip_tags`, PHP strip_tags semantics) ──

class Chars {
  private i = 0;
  constructor(private readonly cs: string[]) {}
  next(): string | undefined {
    return this.i < this.cs.length ? this.cs[this.i++] : undefined;
  }
  peekIsWhitespace(): boolean {
    const c = this.cs[this.i];
    return c !== undefined && /\s/u.test(c);
  }
  /** `next_chars_lowercase_matches`: the next `expected.length` chars, ASCII-lowercased, equal `expected`. */
  lowercaseMatches(expected: string): boolean {
    const want = Array.from(expected);
    const got = this.cs.slice(this.i, this.i + want.length);
    if (got.length !== want.length) return false;
    return got.every((c, k) => c.replace(/[A-Z]/g, (m) => m.toLowerCase()) === want[k]);
  }
}

function consumeHtmlQuote(chars: Chars, quote: string) {
  for (let c = chars.next(); c !== undefined; c = chars.next()) {
    if (c === quote) break;
  }
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
    if (c === "-" && chars.lowercaseMatches("->")) {
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
      if (chars.lowercaseMatches("xml")) {
        chars.next();
        chars.next();
        chars.next();
        consumeXml(chars);
      } else {
        consumePhp(chars);
      }
      break;
    } else if (c === "!" && last === "<" && chars.lowercaseMatches("--")) {
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
