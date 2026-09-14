// Link-preview metadata: route matching, upstream lookup (with a small TTL
// cache), and HTML injection.
//
// Mirrors what the old Dioxus server rendered server-side via `SeoMeta`
// (app/ratel/src/common/components/seo_meta/mod.rs) for the two dynamic
// routes that set it from server data:
//   - app/ratel/src/features/spaces/layout.rs:37-41   (SpaceLayout, wraps
//     every /spaces/:spaceId/** route)
//   - app/ratel/src/features/posts/views/post_detail/component.rs:132-136
//     (PostDetail, exactly /posts/:postId)
//
// The React app only sets these tags client-side (apps/web/src/components/
// ui/seo-meta.tsx, react-helmet-async's <Head>), which crawlers never
// execute — so this server fills in the same tags before the byte stream
// leaves the process, for these two routes only.
//
// Tag de-duplication on hydration: react-helmet-async marks every tag it
// manages with a `data-rh="true"` attribute, and its client commit step
// only ever touches elements matching `<tag>[data-rh]` (see
// node_modules/react-helmet-async/lib/index.js, function `F`). Stamping our
// injected <title>/<meta>/<link> the same way means that once <Head> mounts
// client-side with the (by then loaded) real data, it recognizes our tags
// as "its own" and replaces them in place instead of appending duplicates.
// No change to seo-meta.tsx is required for this to work.

const HELMET_ATTR = 'data-rh="true"';

/** Fallback space image — app/ratel/src/features/spaces/layout.rs:31. */
export const SPACE_FALLBACK_IMAGE = "https://metadata.ratel.foundation/logos/logo-symbol.png";

/**
 * Matches the two route families that carry server-rendered meta in the
 * Dioxus app. Returns `{ kind, id }` or `null`.
 *
 *  - `/spaces/:spaceId` and anything nested under it (dashboard, actions,
 *    apps, ...) — the Dioxus `SpaceLayout` sets the same space-level meta
 *    for every child route via `Outlet`, so we do the same here.
 *  - `/posts/:postId` exactly — `/posts/:postId/edit` (PostEdit) and
 *    `/posts` (PostIndex) have no dynamic SeoMeta in the Dioxus source, so
 *    they are intentionally left unmatched.
 */
export function matchMetaRoute(pathname) {
  let m = pathname.match(/^\/posts\/([^/]+)$/);
  if (m) return { kind: "post", id: m[1] };
  m = pathname.match(/^\/spaces\/([^/]+)(?:\/.*)?$/);
  if (m) return { kind: "space", id: m[1] };
  return null;
}

export function escapeHtmlAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Same approach as the Rust side: strip tags with a regex, no entity decoding. */
export function stripHtmlTags(html) {
  return String(html ?? "").replace(/<[^>]*>/g, "");
}

/**
 * Truncate by Unicode code point ("chars", not bytes/UTF-16 units) —
 * mirrors `strip_html_excerpt` in post_detail/component.rs:585-596, which
 * truncates by `.chars()` so multi-byte (CJK, emoji) content isn't cut
 * mid-codepoint.
 */
export function truncateChars(text, n) {
  const str = String(text ?? "");
  const chars = Array.from(str);
  return chars.length > n ? chars.slice(0, n).join("") : str;
}

/**
 * Best-effort plain-text extraction from a Post `body` (wire-form
 * `BodyJson`, transparent over `ContentBody` — same shape as
 * packages/ts-bridges/src/types/ContentBody.ts):
 *   - `{ content_type: "html_content", data: string }` — tag-stripped like
 *     the Rust `post_html.to_html()` + `strip_html_excerpt` pipeline.
 *   - `{ content_type: "structured_content", data: ContentDocument }` — a
 *     ProseMirror-shaped tree; walk it collecting `text` leaves. This is an
 *     approximation of the real `to_html()` renderer, adequate for a plain
 *     description string.
 */
export function bodyToPlainText(body) {
  if (!body || typeof body !== "object") return "";
  if (body.content_type === "html_content") return stripHtmlTags(body.data);
  if (body.content_type === "structured_content") return extractProseMirrorText(body.data).trim();
  return "";
}

function extractProseMirrorText(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractProseMirrorText).join(" ");
  if (typeof node === "object") {
    let out = typeof node.text === "string" ? node.text : "";
    if (Array.isArray(node.content)) {
      const inner = node.content.map(extractProseMirrorText).join(" ");
      out = out ? `${out} ${inner}` : inner;
    }
    return out;
  }
  return "";
}

/**
 * Builds the exact tag set `SeoMeta` renders for `title`/`description`/
 * `image` (app/ratel/src/common/components/seo_meta/mod.rs:28-62) with
 * `url`/`canonical` left empty — neither call site sets them, so `og:url`
 * and `<link rel="canonical">` are correctly omitted here too.
 */
export function buildMetaTags(meta) {
  const esc = escapeHtmlAttr;
  const tags = [
    `<meta ${HELMET_ATTR} name="description" content="${esc(meta.description)}">`,
    `<meta ${HELMET_ATTR} name="robots" content="index, follow">`,
    `<meta ${HELMET_ATTR} property="og:title" content="${esc(meta.title)}">`,
    `<meta ${HELMET_ATTR} property="og:description" content="${esc(meta.description)}">`,
    `<meta ${HELMET_ATTR} property="og:type" content="website">`,
  ];
  if (meta.image) tags.push(`<meta ${HELMET_ATTR} property="og:image" content="${esc(meta.image)}">`);
  tags.push(`<meta ${HELMET_ATTR} name="twitter:card" content="summary_large_image">`);
  tags.push(`<meta ${HELMET_ATTR} name="twitter:title" content="${esc(meta.title)}">`);
  tags.push(`<meta ${HELMET_ATTR} name="twitter:description" content="${esc(meta.description)}">`);
  if (meta.image) tags.push(`<meta ${HELMET_ATTR} name="twitter:image" content="${esc(meta.image)}">`);
  return tags.join("\n    ");
}

/**
 * Replaces `<title>` and inserts the meta/link tags before `</head>`. Every
 * other byte of the document is left untouched.
 */
export function injectMeta(html, meta) {
  const titleTag = `<title ${HELMET_ATTR}>${escapeHtmlAttr(meta.title)}</title>`;
  let out = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, titleTag);
  const metaBlock = buildMetaTags(meta);
  out = out.replace(/<\/head>/i, `    ${metaBlock}\n  </head>`);
  return out;
}

/**
 * Builds a cached, timeout-bounded, cookie-less anonymous meta lookup for
 * one API origin. `getMeta` never throws — any failure (non-200, timeout,
 * malformed JSON, private/inaccessible entity) resolves to `null` so the
 * caller can fall back to the unmodified page.
 */
export function createMetaFetcher(apiOrigin, opts = {}) {
  const ttlMs = opts.ttlMs ?? 60_000;
  const maxEntries = opts.maxEntries ?? 500;
  const timeoutMs = opts.timeoutMs ?? 1500;
  const fetchImpl = opts.fetchImpl ?? fetch;

  /** @type {Map<string, { value: unknown, expiresAt: number }>} */
  const cache = new Map();

  function cacheGet(key) {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function cacheSet(key, value) {
    cache.delete(key); // re-insert at the end so eviction is oldest-first
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  async function fetchJson(path) {
    // No cookies, no forwarded auth headers — this is an anonymous,
    // unauthenticated view. A private space/post naturally 401/403s here
    // and is treated exactly like any other failure.
    const res = await fetchImpl(new URL(path, apiOrigin), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return res.json();
  }

  async function getMeta(kind, id) {
    if (!apiOrigin) return null;
    const key = `${kind}:${id}`;
    const cached = cacheGet(key);
    if (cached !== undefined) return cached;

    let meta = null;
    try {
      if (kind === "space") {
        const space = await fetchJson(`/api/spaces/${encodeURIComponent(id)}`);
        if (space && typeof space.title === "string") {
          meta = {
            title: space.title,
            description: stripHtmlTags(space.content),
            image: space.logo || SPACE_FALLBACK_IMAGE,
          };
        }
      } else if (kind === "post") {
        const detail = await fetchJson(`/api/posts/${encodeURIComponent(id)}`);
        const post = detail && detail.post;
        if (post && typeof post.title === "string") {
          meta = {
            title: post.title,
            description: truncateChars(bodyToPlainText(post.body), 200),
            image: (Array.isArray(post.urls) && post.urls[0]) || "",
          };
        }
      }
    } catch {
      meta = null; // timeout, network error, non-JSON body, ...
    }

    if (meta) cacheSet(key, meta);
    return meta;
  }

  return { getMeta, cache };
}
