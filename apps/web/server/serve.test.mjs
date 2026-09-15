import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createRequestHandler, API_PREFIXES } from "./serve.mjs";
import { createMetaFetcher, matchMetaRoute, bodyToPlainText, truncateChars } from "./meta.mjs";

const GENERIC_INDEX = `<!doctype html>
<html>
  <head>
    <title>Ratel</title>
    <meta charset="UTF-8" />
  </head>
  <body>
    <div id="main"></div>
  </body>
</html>
`;

const tempDirs = [];

async function makeDist(files) {
  const dir = await mkdtemp(path.join(tmpdir(), "web-server-test-"));
  tempDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
  return dir;
}

after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Starts an app server (our handler) on an ephemeral port; caller must close it. */
function listen(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function serverUrl(server, pathAndQuery = "/") {
  const { port } = server.address();
  return `http://127.0.0.1:${port}${pathAndQuery}`;
}

async function closeAll(...servers) {
  await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))));
}

// ---------------------------------------------------------------------------
// Pure helpers (meta.mjs)
// ---------------------------------------------------------------------------

test("matchMetaRoute matches spaces (nested) and posts (exact only)", () => {
  assert.deepEqual(matchMetaRoute("/spaces/abc"), { kind: "space", id: "abc" });
  assert.deepEqual(matchMetaRoute("/spaces/abc/dashboard"), { kind: "space", id: "abc" });
  assert.deepEqual(matchMetaRoute("/spaces/abc/apps/analyzes"), { kind: "space", id: "abc" });
  assert.deepEqual(matchMetaRoute("/posts/xyz"), { kind: "post", id: "xyz" });
  assert.equal(matchMetaRoute("/posts/xyz/edit"), null);
  assert.equal(matchMetaRoute("/posts"), null);
  assert.equal(matchMetaRoute("/"), null);
  assert.equal(matchMetaRoute("/spaces"), null);
});

test("truncateChars cuts by code point, not UTF-16 unit", () => {
  const emoji = "😀".repeat(5); // each is a surrogate pair (2 UTF-16 units, 1 code point)
  assert.equal(Array.from(truncateChars(emoji, 3)).length, 3);
  assert.equal(truncateChars("hello", 10), "hello");
});

test("bodyToPlainText handles html_content and structured_content", () => {
  assert.equal(bodyToPlainText({ content_type: "html_content", data: "<p>Hi <b>there</b></p>" }), "Hi there");
  assert.equal(
    bodyToPlainText({
      content_type: "structured_content",
      data: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }] },
    }),
    "Hello world",
  );
  assert.equal(bodyToPlainText(null), "");
});

// ---------------------------------------------------------------------------
// Static serving
// ---------------------------------------------------------------------------

test("GET /healthz returns 200 ok", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  const handler = createRequestHandler({ distDir });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/healthz"));
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "ok");
    assert.match(res.headers.get("content-type"), /text\/plain/);
  } finally {
    await closeAll(server);
  }
});

test("serves a static file with the right content-type and cache-control", async () => {
  const distDir = await makeDist({ "foo.txt": "hello world" });
  const handler = createRequestHandler({ distDir });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/foo.txt"));
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "hello world");
    assert.match(res.headers.get("content-type"), /text\/plain/);
    assert.equal(res.headers.get("cache-control"), "public, max-age=3600");
  } finally {
    await closeAll(server);
  }
});

test("/_app/* gets long-lived immutable caching", async () => {
  const distDir = await makeDist({ "_app/main.abcd1234.js": "console.log(1);" });
  const handler = createRequestHandler({ distDir });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/_app/main.abcd1234.js"));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.match(res.headers.get("content-type"), /javascript/);
  } finally {
    await closeAll(server);
  }
});

test("SPA fallback serves dist/index.html for an extension-less unknown path", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  const handler = createRequestHandler({ distDir }); // no apiOrigin -> no meta injection
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/spaces/abc/dashboard"));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-cache");
    assert.match(res.headers.get("content-type"), /text\/html/);
    const body = await res.text();
    assert.equal(body, GENERIC_INDEX);
  } finally {
    await closeAll(server);
  }
});

test("a prerendered file wins over the generic SPA shell", async () => {
  const distDir = await makeDist({
    "index.html": GENERIC_INDEX,
    "privacy/index.html": "<!doctype html><title>Privacy</title>",
  });
  const handler = createRequestHandler({ distDir });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/privacy"));
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Privacy/);
  } finally {
    await closeAll(server);
  }
});

test("404 for a missing file that has an extension", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  const handler = createRequestHandler({ distDir });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/assets/missing.png"));
    assert.equal(res.status, 404);
  } finally {
    await closeAll(server);
  }
});

test("path traversal is blocked", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  // A secret file that must never be reachable, placed as a sibling of distDir.
  const secretDir = path.dirname(distDir);
  await writeFile(path.join(secretDir, "secret.txt"), "top secret");
  const handler = createRequestHandler({ distDir });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/%2e%2e/secret.txt"));
    assert.notEqual(res.status, 200);
    const res2 = await fetch(serverUrl(server, "/../secret.txt"));
    assert.notEqual(res2.status, 200);
  } finally {
    await closeAll(server);
  }
});

test("HEAD returns headers with no body", async () => {
  const distDir = await makeDist({ "foo.txt": "hello world" });
  const handler = createRequestHandler({ distDir });
  const server = await listen(handler);
  try {
    // Use node:http directly — some `fetch` (undici) implementations drop
    // `content-length` from the Headers object on a HEAD response.
    const { statusCode, headers, body } = await new Promise((resolve, reject) => {
      const req = httpRequest(serverUrl(server, "/foo.txt"), { method: "HEAD" }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      });
      req.on("error", reject);
      req.end();
    });
    assert.equal(statusCode, 200);
    assert.equal(headers["content-length"], "11");
    assert.equal(body.length, 0);
  } finally {
    await closeAll(server);
  }
});

test("gzip compresses text responses when the client accepts it", async () => {
  const big = "x".repeat(5000);
  const distDir = await makeDist({ "big.txt": big });
  const handler = createRequestHandler({ distDir });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/big.txt"), { headers: { "accept-encoding": "gzip" } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-encoding"), "gzip");
    // `fetch` auto-decompresses; check the underlying bytes decode back to the original.
    const text = await res.text();
    assert.equal(text, big);
  } finally {
    await closeAll(server);
  }
});

// ---------------------------------------------------------------------------
// Link-preview meta injection
// ---------------------------------------------------------------------------

function startFakeUpstream(routeHandler) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => routeHandler(req, res));
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("injects space meta for /spaces/:id and nested paths", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  const upstream = await startFakeUpstream((req, res) => {
    if (req.url === "/api/spaces/space1") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          title: "Great Space",
          content: "<p>Hello <b>World</b></p>",
          logo: "https://img.example/logo.png",
        }),
      );
      return;
    }
    res.writeHead(404).end();
  });
  const handler = createRequestHandler({ distDir, apiOrigin: `http://127.0.0.1:${upstream.address().port}` });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/spaces/space1/dashboard"));
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(body, /<title data-rh="true">Great Space<\/title>/);
    assert.match(body, /name="description" content="Hello World"/);
    assert.match(body, /property="og:image" content="https:\/\/img\.example\/logo\.png"/);
    assert.match(body, /data-rh="true"/); // marked so react-helmet-async can take over
  } finally {
    await closeAll(server, upstream);
  }
});

test("injects post meta only for the exact /posts/:id route", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  const upstream = await startFakeUpstream((req, res) => {
    if (req.url === "/api/posts/post1") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          post: {
            title: "My Post",
            body: { content_type: "html_content", data: "<p>Some &amp; content</p>" },
            urls: ["https://img.example/post.jpg"],
          },
        }),
      );
      return;
    }
    res.writeHead(404).end();
  });
  const handler = createRequestHandler({ distDir, apiOrigin: `http://127.0.0.1:${upstream.address().port}` });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/posts/post1"));
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(body, /<title data-rh="true">My Post<\/title>/);
    assert.match(body, /twitter:image" content="https:\/\/img\.example\/post\.jpg"/);

    // /posts/:id/edit has no dynamic SeoMeta in the Dioxus source — must not be touched.
    const editRes = await fetch(serverUrl(server, "/posts/post1/edit"));
    const editBody = await editRes.text();
    assert.equal(editBody, GENERIC_INDEX);
  } finally {
    await closeAll(server, upstream);
  }
});

test("falls back to the unmodified page when the upstream 404s (e.g. private space)", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  const upstream = await startFakeUpstream((req, res) => {
    res.writeHead(404).end();
  });
  const handler = createRequestHandler({ distDir, apiOrigin: `http://127.0.0.1:${upstream.address().port}` });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/spaces/missing/dashboard"));
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.equal(body, GENERIC_INDEX);
  } finally {
    await closeAll(server, upstream);
  }
});

test("falls back to the unmodified page when the upstream times out", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  const upstream = await startFakeUpstream((req, res) => {
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ title: "Too Slow", content: "" }));
    }, 200);
  });
  const metaFetcher = createMetaFetcher(`http://127.0.0.1:${upstream.address().port}`, { timeoutMs: 20 });
  const handler = createRequestHandler({ distDir, metaFetcher });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/spaces/slow/dashboard"));
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.equal(body, GENERIC_INDEX);
  } finally {
    await closeAll(server, upstream);
  }
});

test("meta lookups never forward the viewer's cookies", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  let sawCookieHeader = false;
  const upstream = await startFakeUpstream((req, res) => {
    if ("cookie" in req.headers) sawCookieHeader = true;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ title: "T", content: "" }));
  });
  const handler = createRequestHandler({ distDir, apiOrigin: `http://127.0.0.1:${upstream.address().port}` });
  const server = await listen(handler);
  try {
    await fetch(serverUrl(server, "/spaces/space1"), { headers: { cookie: "session=super-secret" } });
    assert.equal(sawCookieHeader, false);
  } finally {
    await closeAll(server, upstream);
  }
});

test("meta cache serves a second identical lookup without hitting the upstream again", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  let hitCount = 0;
  const upstream = await startFakeUpstream((req, res) => {
    hitCount += 1;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ title: "Cached Space", content: "" }));
  });
  const handler = createRequestHandler({ distDir, apiOrigin: `http://127.0.0.1:${upstream.address().port}` });
  const server = await listen(handler);
  try {
    await fetch(serverUrl(server, "/spaces/cachey"));
    await fetch(serverUrl(server, "/spaces/cachey"));
    assert.equal(hitCount, 1);
  } finally {
    await closeAll(server, upstream);
  }
});

// ---------------------------------------------------------------------------
// Page cache (finished HTML kept in memory, like the Dioxus ssr_cache)
// ---------------------------------------------------------------------------

test("a failed meta lookup is cached briefly, so repeated requests don't re-hit the upstream", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  let hitCount = 0;
  const upstream = await startFakeUpstream((req, res) => {
    hitCount += 1;
    res.writeHead(404).end();
  });
  const handler = createRequestHandler({ distDir, apiOrigin: `http://127.0.0.1:${upstream.address().port}` });
  const server = await listen(handler);
  try {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(serverUrl(server, "/spaces/private1"));
      assert.equal(await res.text(), GENERIC_INDEX);
    }
    assert.equal(hitCount, 1);
  } finally {
    await closeAll(server, upstream);
  }
});

test("concurrent requests for an uncached page share one meta lookup", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  let hitCount = 0;
  const upstream = await startFakeUpstream((req, res) => {
    hitCount += 1;
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ title: "Busy Space", content: "" }));
    }, 50);
  });
  const handler = createRequestHandler({ distDir, apiOrigin: `http://127.0.0.1:${upstream.address().port}` });
  const server = await listen(handler);
  try {
    const bodies = await Promise.all(
      Array.from({ length: 10 }, () => fetch(serverUrl(server, "/spaces/busy")).then((r) => r.text())),
    );
    assert.equal(hitCount, 1);
    for (const body of bodies) assert.match(body, /<title data-rh="true">Busy Space<\/title>/);
  } finally {
    await closeAll(server, upstream);
  }
});

test("a rebuilt index.html is served without restarting the server", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  const handler = createRequestHandler({ distDir, templateCheckMs: 0 });
  const server = await listen(handler);
  try {
    assert.equal(await (await fetch(serverUrl(server, "/some/page"))).text(), GENERIC_INDEX);
    const rebuilt = GENERIC_INDEX.replace("<title>Ratel</title>", "<title>Rebuilt</title>");
    // Make sure the mtime moves even on filesystems with coarse timestamps.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await writeFile(path.join(distDir, "index.html"), rebuilt);
    const { utimes } = await import("node:fs/promises");
    const later = new Date(Date.now() + 5000);
    await utimes(path.join(distDir, "index.html"), later, later);
    assert.equal(await (await fetch(serverUrl(server, "/some/page"))).text(), rebuilt);
  } finally {
    await closeAll(server);
  }
});

test("cached pages keep the gzip/plain contract and HEAD returns no body", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  const handler = createRequestHandler({ distDir });
  const server = await listen(handler);
  try {
    const gz = await fetch(serverUrl(server, "/cached"), { headers: { "accept-encoding": "gzip" } });
    assert.equal(gz.headers.get("content-encoding"), "gzip");
    assert.equal(gz.headers.get("cache-control"), "no-cache");
    assert.equal(await gz.text(), GENERIC_INDEX);

    const plain = await fetch(serverUrl(server, "/cached"), { headers: { "accept-encoding": "identity" } });
    assert.equal(plain.headers.get("content-encoding"), null);
    assert.equal(await plain.text(), GENERIC_INDEX);

    const head = await new Promise((resolve, reject) => {
      const req = httpRequest(serverUrl(server, "/cached"), { method: "HEAD" }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, length: res.headers["content-length"], body: Buffer.concat(chunks) }));
      });
      req.on("error", reject);
      req.end();
    });
    assert.equal(head.status, 200);
    assert.equal(head.length, String(Buffer.byteLength(GENERIC_INDEX)));
    assert.equal(head.body.length, 0);
  } finally {
    await closeAll(server);
  }
});

// ---------------------------------------------------------------------------
// Proxy (PROXY_API=1 local end-to-end testing mode)
// ---------------------------------------------------------------------------

test("proxy passes through method, body, status, headers and multiple set-cookie", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  let receivedBody = "";
  let receivedForwardedFor;
  const upstream = await startFakeUpstream((req, res) => {
    receivedForwardedFor = req.headers["x-forwarded-for"];
    req.on("data", (chunk) => (receivedBody += chunk));
    req.on("end", () => {
      res.writeHead(201, {
        "content-type": "application/json",
        "x-upstream": "yes",
        "set-cookie": ["a=1; Path=/", "b=2; Path=/"],
      });
      res.end(JSON.stringify({ echoed: receivedBody }));
    });
  });
  const handler = createRequestHandler({
    distDir,
    proxyApi: true,
    apiOrigin: `http://127.0.0.1:${upstream.address().port}`,
  });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/api/echo"), {
      method: "POST",
      body: JSON.stringify({ hello: "world" }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("x-upstream"), "yes");
    assert.equal(res.headers.getSetCookie().length, 2);
    const body = await res.json();
    assert.equal(body.echoed, JSON.stringify({ hello: "world" }));
    assert.ok(receivedForwardedFor && receivedForwardedFor.length > 0);
  } finally {
    await closeAll(server, upstream);
  }
});

test("proxy streams SSE chunks incrementally, not buffered until the end", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  const upstream = await startFakeUpstream((req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write("data: 1\n\n");
    setTimeout(() => {
      res.write("data: 2\n\n");
      res.end();
    }, 150);
  });
  const handler = createRequestHandler({
    distDir,
    proxyApi: true,
    apiOrigin: `http://127.0.0.1:${upstream.address().port}`,
  });
  const server = await listen(handler);
  try {
    const timestamps = await new Promise((resolve, reject) => {
      const chunks = [];
      const req = httpRequest(serverUrl(server, "/api/arcade/events"), (res) => {
        res.on("data", () => chunks.push(process.hrtime.bigint()));
        res.on("end", () => resolve(chunks));
        res.on("error", reject);
      });
      req.on("error", reject);
      req.end();
    });
    assert.ok(timestamps.length >= 2, `expected >= 2 chunks, got ${timestamps.length}`);
    const gapMs = Number(timestamps[timestamps.length - 1] - timestamps[0]) / 1e6;
    assert.ok(gapMs >= 100, `expected a real gap between chunks (SSE not buffered), got ${gapMs}ms`);
  } finally {
    await closeAll(server, upstream);
  }
});

test("proxy disabled: API-prefixed paths get ordinary SPA-fallback handling", async () => {
  const distDir = await makeDist({ "index.html": GENERIC_INDEX });
  let upstreamHit = false;
  const upstream = await startFakeUpstream((req, res) => {
    upstreamHit = true;
    res.writeHead(200).end("should never be reached");
  });
  const handler = createRequestHandler({
    distDir,
    apiOrigin: `http://127.0.0.1:${upstream.address().port}`, // still used for meta lookups, not proxying
    // proxyApi intentionally omitted/false
  });
  const server = await listen(handler);
  try {
    const res = await fetch(serverUrl(server, "/api/x"));
    // Documented decision: with PROXY_API unset, this server has no special
    // knowledge of API_PREFIXES — an extension-less path just falls through
    // to the normal SPA-fallback rule (200, dist/index.html). In the real
    // k3s deployment the ingress never routes such a path here at all.
    assert.equal(res.status, 200);
    assert.equal(await res.text(), GENERIC_INDEX);
    assert.equal(upstreamHit, false);
  } finally {
    await closeAll(server, upstream);
  }
});

test("API_PREFIXES matches path segments, not arbitrary substrings", () => {
  assert.ok(API_PREFIXES.includes("/api"));
  const matches = (p) => API_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
  assert.equal(matches("/api"), true);
  assert.equal(matches("/api/x"), true);
  assert.equal(matches("/apis"), false);
});
