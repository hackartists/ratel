#!/usr/bin/env node
// Zero-dependency Node static server for the built React app
// (apps/web/dist). Runs in the k3s pod behind an ingress that routes API
// paths to the Rust `app-shell` service and everything else here.
//
// Only `node:` built-ins are used (Node 22). See apps/web/server/meta.mjs
// for the link-preview metadata piece.

import { createServer as createHttpServer } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createReadStream } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { gzip as gzipCallback, createGzip } from "node:zlib";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { matchMetaRoute, injectMeta, createMetaFetcher } from "./meta.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const gzipAsync = promisify(gzipCallback);

/**
 * Prefixes the Rust `app-shell` owns, mirrored from `API_PREFIXES` in
 * apps/web/vite.config.ts, plus the three extra server-owned prefixes that
 * file's dev-proxy list doesn't need (dev proxies everything through Vite
 * either way, but the ingress and this server's `PROXY_API=1` test mode
 * both need the full list):
 *   - `/admin/proxy`  — server-side admin proxy passthrough
 *   - `/designs`      — design mockup static files served by app-shell
 *   - `/roadmap`      — roadmap markdown served by app-shell
 * Matched on path-segment prefix: `/api` matches `/api` and `/api/x`, not
 * `/apis`.
 */
export const API_PREFIXES = [
  "/api",
  "/v3",
  "/mcp",
  "/hooks",
  "/launchpad/health",
  "/launchpad/points",
  "/admin/proxy",
  "/designs",
  "/roadmap",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".lottie": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
  ".mp4": "video/mp4",
};

/** Extensions worth gzipping — text-ish content only. */
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".xml", ".txt", ".webmanifest"]);

const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

/**
 * Page HTML caching. Every extension-less request resolves to the same few
 * HTML files, and the link-preview meta for a space/post changes rarely, so
 * the finished page — meta injected, plain and gzipped — is kept in memory
 * and a request only looks it up and writes it. This is what the Dioxus
 * server's `ssr_cache` did for anonymous `/spaces/**` pages; without it every
 * request re-read index.html and gzipped it synchronously, which saturated
 * the pod's single thread under load (tc14).
 *   - `htmlCacheTtlMs`: how long a page with meta (or without meta routes) lives;
 *     matches the meta fetcher's own 60s cache.
 *   - `htmlNegativeTtlMs`: a meta route whose lookup failed (private or missing
 *     space, upstream timeout) is served unmodified and retried after this.
 *   - `templateCheckMs`: how often an HTML file's mtime is re-checked, so a
 *     rebuilt dist (local runs) is picked up without a restart.
 */
const HTML_CACHE_DEFAULTS = {
  htmlCacheTtlMs: 60_000,
  htmlNegativeTtlMs: 10_000,
  htmlCacheMaxEntries: 1000,
  templateCheckMs: 5_000,
};

function matchesApiPrefix(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Cheap collapsing `..`/`.` resolver that can never escape above `/`. */
function normalizePathname(pathname) {
  const segments = pathname.split("/");
  const out = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return `/${out.join("/")}`;
}

/** Resolves `pathname` under `distDir`, refusing to resolve outside it. */
function resolveWithinDist(distDir, pathname) {
  const rel = pathname.replace(/^\/+/, "");
  const abs = path.resolve(distDir, rel);
  const base = path.resolve(distDir);
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}

function joinPath(pathname, file) {
  const trimmed = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return `${trimmed}/${file}`;
}

function cacheControlFor(pathname, ext) {
  if (pathname.startsWith("/_app/")) return "public, max-age=31536000, immutable";
  if (ext === ".html") return "no-cache";
  return "public, max-age=3600";
}

async function isFile(absPath) {
  try {
    const s = await stat(absPath);
    return s.isFile();
  } catch {
    return false;
  }
}

function acceptsGzip(req) {
  return (req.headers["accept-encoding"] || "").includes("gzip");
}

/** Serves an on-disk file, streaming through gzip when accepted. */
async function sendFile(req, res, absPath, pathname, ext) {
  const stats = await stat(absPath);
  const contentType = MIME[ext] || "application/octet-stream";
  const cacheControl = cacheControlFor(pathname, ext);
  const compress = COMPRESSIBLE.has(ext) && acceptsGzip(req);

  const headers = { "content-type": contentType, "cache-control": cacheControl };

  if (req.method === "HEAD") {
    if (!compress) headers["content-length"] = String(stats.size);
    res.writeHead(200, headers);
    res.end();
    return 200;
  }

  if (compress) {
    headers["content-encoding"] = "gzip";
    res.writeHead(200, headers);
    const src = createReadStream(absPath);
    src.on("error", () => res.destroy());
    src.pipe(createGzip()).pipe(res);
  } else {
    headers["content-length"] = String(stats.size);
    res.writeHead(200, headers);
    const src = createReadStream(absPath);
    src.on("error", () => res.destroy());
    src.pipe(res);
  }
  return 200;
}

/** Writes a cached page (`{ plain, gzipped }` buffers). */
function sendPage(req, res, page) {
  const compress = acceptsGzip(req);
  const body = compress ? page.gzipped : page.plain;
  const headers = {
    "content-type": MIME[".html"],
    "cache-control": "no-cache",
    "content-length": String(body.length),
  };
  if (compress) headers["content-encoding"] = "gzip";
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}

/**
 * In-memory page cache with request coalescing: concurrent misses for the
 * same key share one build instead of each fetching meta and gzipping.
 */
function createPageCache({ htmlCacheMaxEntries }) {
  /** @type {Map<string, { page: { plain: Buffer, gzipped: Buffer }, expiresAt: number }>} */
  const entries = new Map();
  /** @type {Map<string, Promise<{ plain: Buffer, gzipped: Buffer }>>} */
  const inflight = new Map();

  async function get(key, build) {
    const hit = entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.page;
    if (hit) entries.delete(key);

    const pending = inflight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      const { page, ttlMs } = await build();
      entries.set(key, { page, expiresAt: Date.now() + ttlMs });
      while (entries.size > htmlCacheMaxEntries) {
        entries.delete(entries.keys().next().value);
      }
      return page;
    })();
    inflight.set(key, promise);
    try {
      return await promise;
    } finally {
      inflight.delete(key);
    }
  }

  return { get, entries };
}

/**
 * HTML file contents, read once and re-validated by mtime at most every
 * `templateCheckMs`; `resolve` caches which HTML file a path maps to on the
 * same schedule (dist does not change inside a k3s pod).
 */
function createTemplateStore(distDir, { templateCheckMs }) {
  /** @type {Map<string, { text: string, mtimeMs: number, checkedAt: number }>} */
  const templates = new Map();
  /** @type {Map<string, { htmlPath: string | null, checkedAt: number }>} */
  const resolutions = new Map();
  const MAX_RESOLUTIONS = 5000;

  async function resolve(pathname) {
    const now = Date.now();
    const cached = resolutions.get(pathname);
    if (cached && now - cached.checkedAt < templateCheckMs) return cached.htmlPath;

    // No extension: an explicitly prerendered page wins, then the SPA shell.
    const candidates = [
      resolveWithinDist(distDir, joinPath(pathname, "index.html")),
      resolveWithinDist(distDir, `${pathname}.html`),
      resolveWithinDist(distDir, "/index.html"),
    ];
    let htmlPath = null;
    for (const candidate of candidates) {
      if (candidate && (await isFile(candidate))) {
        htmlPath = candidate;
        break;
      }
    }
    resolutions.set(pathname, { htmlPath, checkedAt: now });
    while (resolutions.size > MAX_RESOLUTIONS) {
      resolutions.delete(resolutions.keys().next().value);
    }
    return htmlPath;
  }

  async function load(htmlPath) {
    const now = Date.now();
    const cached = templates.get(htmlPath);
    if (cached && now - cached.checkedAt < templateCheckMs) return cached;

    const { mtimeMs } = await stat(htmlPath);
    if (cached && cached.mtimeMs === mtimeMs) {
      cached.checkedAt = now;
      return cached;
    }
    const entry = { text: await readFile(htmlPath, "utf8"), mtimeMs, checkedAt: now };
    templates.set(htmlPath, entry);
    return entry;
  }

  return { resolve, load };
}

async function serveStatic(req, res, pathname, config) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": MIME[".txt"], allow: "GET, HEAD" });
    res.end("method not allowed");
    return 405;
  }

  const ext = path.extname(pathname);

  if (ext) {
    const filePath = resolveWithinDist(config.distDir, pathname);
    if (filePath && (await isFile(filePath))) {
      return sendFile(req, res, filePath, pathname, ext);
    }
    res.writeHead(404, { "content-type": MIME[".txt"] });
    res.end("not found");
    return 404;
  }

  const htmlPath = await config.templates.resolve(pathname);
  if (!htmlPath) {
    res.writeHead(404, { "content-type": MIME[".txt"] });
    res.end("not found");
    return 404;
  }

  const template = await config.templates.load(htmlPath);
  const metaRoute = config.metaFetcher ? matchMetaRoute(pathname) : null;
  const key = `${htmlPath}|${template.mtimeMs}|${metaRoute ? `${metaRoute.kind}:${metaRoute.id}` : ""}`;

  const page = await config.pages.get(key, async () => {
    let html = template.text;
    let ttlMs = config.htmlCacheTtlMs;
    if (metaRoute) {
      const meta = await config.metaFetcher.getMeta(metaRoute.kind, metaRoute.id);
      if (meta) html = injectMeta(html, meta);
      else ttlMs = config.htmlNegativeTtlMs; // any failure -> unmodified page, retried soon
    }
    const plain = Buffer.from(html, "utf8");
    return { page: { plain, gzipped: await gzipAsync(plain) }, ttlMs };
  });

  sendPage(req, res, page);
  return 200;
}

function appendForwardedFor(existing, remoteAddress) {
  const addr = remoteAddress || "";
  return existing ? `${existing}, ${addr}` : addr;
}

function stripHopByHopHeaders(headers) {
  const out = { ...headers };
  for (const name of HOP_BY_HOP_HEADERS) delete out[name];
  return out;
}

/**
 * Streams a request through to `apiOrigin`, unchanged apart from the
 * `Host`/`X-Forwarded-*` rewrite `changeOrigin: true` does in Vite's dev
 * proxy. Both request and response bodies are streamed (not buffered), so
 * large uploads and Server-Sent Events (`/api/arcade/events`) flush
 * incrementally.
 */
function proxyRequest(req, res, apiOrigin) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(apiOrigin);
    } catch {
      res.writeHead(502, { "content-type": MIME[".txt"] });
      res.end("bad upstream configuration");
      resolve(502);
      return;
    }

    const pathAndQuery = req.url || "/";
    const headers = stripHopByHopHeaders(req.headers);
    headers.host = target.host;
    headers["x-forwarded-for"] = appendForwardedFor(req.headers["x-forwarded-for"], req.socket.remoteAddress);
    headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] || "http";
    headers["x-forwarded-host"] = req.headers.host || "";

    const transportRequest = target.protocol === "https:" ? httpsRequest : httpRequest;
    const proxyReq = transportRequest(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: pathAndQuery,
        method: req.method,
        headers,
      },
      (proxyRes) => {
        const resHeaders = stripHopByHopHeaders(proxyRes.headers);
        res.writeHead(proxyRes.statusCode || 502, resHeaders);
        proxyRes.pipe(res);
        proxyRes.on("end", () => resolve(proxyRes.statusCode || 502));
        proxyRes.on("error", () => {
          res.destroy();
          resolve(proxyRes.statusCode || 502);
        });
      },
    );

    proxyReq.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": MIME[".txt"] });
        res.end("upstream error");
      } else {
        res.end();
      }
      resolve(502);
    });

    req.on("error", () => proxyReq.destroy());
    req.pipe(proxyReq);
  });
}

/**
 * Builds the request handler. `config`:
 *   - `distDir` (required): absolute path to the built app.
 *   - `apiOrigin`: base URL for meta lookups (and, when `proxyApi` is set,
 *     for the local-testing proxy). Meta injection is disabled when unset.
 *   - `proxyApi`: proxy API-prefixed paths to `apiOrigin` (local
 *     end-to-end testing only — off in k3s, where the ingress does this).
 *   - `metaFetcher`: override the meta fetcher (tests inject a fake one;
 *     otherwise one is built from `apiOrigin`).
 *   - `logRequests`: `"all"` logs every request; otherwise (default) only
 *     errors (status >= 400) and requests slower than 1s. Logging each of
 *     thousands of requests per second costs the single thread real time.
 *   - `htmlCacheTtlMs` / `htmlNegativeTtlMs` / `htmlCacheMaxEntries` /
 *     `templateCheckMs`: page cache tuning (see HTML_CACHE_DEFAULTS).
 */
export function createRequestHandler(config) {
  const cacheOptions = { ...HTML_CACHE_DEFAULTS };
  for (const key of Object.keys(HTML_CACHE_DEFAULTS)) {
    if (config[key] !== undefined) cacheOptions[key] = config[key];
  }
  const resolved = {
    distDir: config.distDir,
    apiOrigin: config.apiOrigin || "",
    proxyApi: Boolean(config.proxyApi),
    metaFetcher: config.metaFetcher ?? (config.apiOrigin ? createMetaFetcher(config.apiOrigin) : null),
    logAll: config.logRequests === "all",
    ...cacheOptions,
    templates: createTemplateStore(config.distDir, cacheOptions),
    pages: createPageCache(cacheOptions),
  };

  return async function handleRequest(req, res) {
    const start = process.hrtime.bigint();
    const rawUrl = req.url || "/";
    const queryIndex = rawUrl.indexOf("?");
    const rawPathname = queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);

    let pathname;
    try {
      pathname = normalizePathname(decodeURIComponent(rawPathname));
    } catch {
      pathname = normalizePathname(rawPathname);
    }

    let statusCode = 200;
    try {
      if (pathname === "/healthz") {
        res.writeHead(200, { "content-type": MIME[".txt"] });
        res.end("ok");
        return;
      } else if (resolved.proxyApi && matchesApiPrefix(pathname, API_PREFIXES)) {
        statusCode = await proxyRequest(req, res, resolved.apiOrigin);
      } else {
        statusCode = await serveStatic(req, res, pathname, resolved);
      }
    } catch (err) {
      statusCode = 500;
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": MIME[".txt"] });
        res.end("internal error");
      } else {
        res.end();
      }
      console.error(`[serve] ${req.method} ${pathname} threw:`, err);
    } finally {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (pathname !== "/healthz" && (resolved.logAll || statusCode >= 400 || ms >= 1000)) {
        console.log(`${req.method} ${pathname} ${statusCode} ${ms.toFixed(1)}ms`);
      }
    }
  };
}

export function configFromEnv() {
  return {
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || "0.0.0.0",
    distDir: process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.resolve(here, "../dist"),
    apiOrigin: process.env.API_ORIGIN || "",
    proxyApi: process.env.PROXY_API === "1",
    logRequests: process.env.LOG_REQUESTS || "",
  };
}

export function startServer(config) {
  const handler = createRequestHandler(config);
  const server = createHttpServer(handler);

  server.listen(config.port, config.host, () => {
    console.log(`[serve] listening on http://${config.host}:${config.port} (distDir=${config.distDir})`);
    if (!config.apiOrigin) {
      console.log("[serve] API_ORIGIN not set — link-preview meta injection is disabled");
    }
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[serve] received ${signal}, shutting down`);
    server.close(() => process.exit(0));
    // Force-exit if connections don't drain in time.
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}

// Only start listening when run directly (`node server/serve.mjs`), never
// when imported (e.g. by serve.test.mjs).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startServer(configFromEnv());
}
