// app/ratel/src/common/types/content/render.rs — `ContentBody::to_html()`: the
// lossy HTML projection of a post body (one element per block, inline runs as
// code/strong/em/s/u/a). Same output string, byte for byte.
import type { Block, ContentBody, ContentDocument, MediaSource, RichText } from "@ratel/ts-bridges";

function escapeHtml(input: string): string {
  let out = "";
  for (const ch of input) {
    if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else if (ch === "&") out += "&amp;";
    else out += ch;
  }
  return out;
}

function escapeAttr(input: string): string {
  let out = "";
  for (const ch of input) {
    if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else if (ch === "&") out += "&amp;";
    else if (ch === '"') out += "&quot;";
    else if (ch === "'") out += "&#39;";
    else out += ch;
  }
  return out;
}

function richTextPlain(text: RichText): string {
  let out = "";
  for (const node of text) {
    if (node.type === "text") out += node.data.content;
    else if (node.type === "equation") out += node.data.expression;
  }
  return out;
}

function richTextHtml(text: RichText): string {
  let out = "";
  for (const node of text) {
    if (node.type === "text") {
      const t = node.data;
      let s = escapeHtml(t.content);
      if (t.annotations.code) s = `<code>${s}</code>`;
      if (t.annotations.bold) s = `<strong>${s}</strong>`;
      if (t.annotations.italic) s = `<em>${s}</em>`;
      if (t.annotations.strikethrough) s = `<s>${s}</s>`;
      if (t.annotations.underline) s = `<u>${s}</u>`;
      if (t.link !== null) s = `<a href="${escapeAttr(t.link)}">${s}</a>`;
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
      out += `<p>${richTextHtml(block.data.rich_text)}</p>`;
      break;
    case "heading":
      out += `<${block.data.level}>${richTextHtml(block.data.rich_text)}</${block.data.level}>`;
      break;
    case "bulleted_list_item":
    case "numbered_list_item":
      out += `<li>${richTextHtml(block.data.rich_text)}</li>`;
      break;
    case "quote":
      out += `<blockquote>${richTextHtml(block.data.rich_text)}</blockquote>`;
      break;
    case "toggle":
      out += `<details><summary>${richTextHtml(block.data.rich_text)}</summary></details>`;
      break;
    case "todo":
      out += `<label><input type="checkbox" disabled ${block.data.checked ? "checked " : ""}>${richTextHtml(block.data.rich_text)}</label>`;
      break;
    case "code":
      out += `<pre><code>${richTextPlain(block.data.rich_text)}</code></pre>`;
      break;
    case "callout":
      out += `<aside>${richTextHtml(block.data.rich_text)}</aside>`;
      break;
    case "equation":
      out += `<span class="math">${escapeHtml(block.data.expression)}</span>`;
      break;
    case "image": {
      out += `<img src="${escapeAttr(mediaUrl(block.data.source))}"`;
      if (block.data.alt !== null) out += ` alt="${escapeAttr(block.data.alt)}"`;
      out += " />";
      break;
    }
    case "video":
    case "file":
      out += `<a href="${escapeAttr(mediaUrl(block.data.source))}">${richTextHtml(block.data.caption)}</a>`;
      break;
    case "bookmark":
      out += `<a href="${escapeAttr(block.data.url)}">${richTextHtml(block.data.caption)}</a>`;
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

/** Rust `ContentDocument::to_html()`. */
export function contentDocumentToHtml(doc: ContentDocument): string {
  return doc.blocks.map(blockHtml).join("");
}

/** Rust `ContentBody::to_html()`. */
export function contentBodyToHtml(body: ContentBody): string {
  return body.content_type === "html_content" ? body.data : contentDocumentToHtml(body.data);
}

/** Rust `ContentBody::html`. */
export function htmlContent(html: string): ContentBody {
  return { content_type: "html_content", data: html };
}

/** Rust `ContentBody::to_html`. */
export function toHtml(body: ContentBody): string {
  return contentBodyToHtml(body);
}

/** Strips tags, leaving plain text — the private `strip_html` helper duplicated in post_edit and the compose sidebar. */
export function stripHtml(html: string): string {
  let result = "";
  let inTag = false;
  for (const ch of html) {
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag) result += ch;
  }
  return result;
}
