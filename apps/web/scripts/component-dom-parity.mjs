// DOM parity check for ported shared components
// (docs/superpower/2026-09-14-react-frontend-migration.md §3.2–3.3).
//
//   node apps/web/scripts/component-dom-parity.mjs [fixture ...]
//
// Bundles src/components/ui/__dom__/fixtures.tsx with esbuild into a temp dir
// (outside the repo), renders every fixture into jsdom with react-dom/client,
// lets effects settle (and runs the fixture's `interact` step), then compares
// the resulting DOM with `__dom__/<name>.expected.html` — the DOM the Dioxus
// component renders for the same props.
//
// Both sides are canonicalized before comparing: attributes sorted by name,
// boolean attributes reduced to presence, inline styles split into sorted
// declarations, whitespace-only text dropped, comments dropped, and generated
// ids (id / aria-controls / aria-labelledby / aria-describedby / for) replaced
// by tokens in order of first appearance, because Dioxus (`dxc-N`) and React
// (`:rN:`) generate different id strings. Class strings are compared verbatim.
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");
const domDir = resolve(web, "src/components/ui/__dom__");

const BOOLEAN_ATTRS = new Set(["disabled", "hidden", "checked", "required", "readonly", "selected", "open", "multiple"]);
const ID_ATTRS = new Set(["id", "aria-controls", "aria-labelledby", "aria-describedby", "for"]);

function canonical(root) {
  const tokens = new Map();
  const token = (value) => {
    if (!tokens.has(value)) tokens.set(value, `#id${tokens.size + 1}`);
    return tokens.get(value);
  };
  const lines = [];
  const walk = (node, depth) => {
    for (const child of node.childNodes) {
      const pad = "  ".repeat(depth);
      if (child.nodeType === 3) {
        const text = child.textContent.replace(/\s+/g, " ").trim();
        if (text) lines.push(`${pad}${JSON.stringify(text)}`);
      } else if (child.nodeType === 1) {
        const attrs = [...child.attributes]
          .map((a) => {
            const name = a.name.toLowerCase();
            let value = a.value;
            if (BOOLEAN_ATTRS.has(name)) value = "";
            else if (ID_ATTRS.has(name)) value = value.split(/\s+/).filter(Boolean).map(token).join(" ");
            else if (name === "style")
              value = value
                .split(";")
                .map((d) => d.trim())
                .filter(Boolean)
                .map((d) => {
                  const at = d.indexOf(":");
                  return `${d.slice(0, at).trim().toLowerCase()}:${d.slice(at + 1).trim()}`;
                })
                .sort()
                .join(";");
            return [name, value];
          })
          .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
          .map(([n, v]) => `${n}=${JSON.stringify(v)}`);
        lines.push(`${pad}<${child.localName.toLowerCase()}${attrs.length ? " " + attrs.join(" ") : ""}>`);
        walk(child, depth + 1);
      }
    }
  };
  walk(root, 0);
  return lines;
}

// jsdom globals must exist before React loads (react-dom probes `window`).
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (!(key in globalThis)) {
    try {
      globalThis[key] = dom.window[key];
    } catch {
      // read-only Node globals (navigator, crypto, ...) stay as they are
    }
  }
}
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const tmp = mkdtempSync(join(tmpdir(), "ratel-dom-parity-"));
let failed = 0;
try {
  const outfile = join(tmp, "fixtures.mjs");
  await build({
    stdin: {
      contents: [
        `export { fixtures } from "./src/components/ui/__dom__/fixtures.tsx";`,
        `export { createRoot } from "react-dom/client";`,
        `export { act } from "react";`,
      ].join("\n"),
      resolveDir: web,
      loader: "tsx",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    tsconfig: resolve(web, "tsconfig.json"),
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    outfile,
    logLevel: "error",
  });
  const { fixtures, createRoot, act } = await import(pathToFileURL(outfile).href);

  const expectedNames = readdirSync(domDir)
    .filter((f) => f.endsWith(".expected.html"))
    .map((f) => f.slice(0, -".expected.html".length));
  const only = process.argv.slice(2);
  const names = [...new Set([...Object.keys(fixtures), ...expectedNames])]
    .sort()
    .filter((n) => only.length === 0 || only.includes(n));

  // React logs act()/key warnings through console.error; surface them as failures.
  const consoleErrors = [];
  const originalError = console.error;
  console.error = (...args) => consoleErrors.push(args.map(String).join(" "));

  for (const name of names) {
    const fixture = fixtures[name];
    if (!fixture || !expectedNames.includes(name)) {
      console.log(`FAIL ${name}: ${fixture ? "missing expected HTML" : "missing fixture"}`);
      failed += 1;
      continue;
    }
    consoleErrors.length = 0;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
    await act(async () => root.render(fixture.render()));
    await settle();
    if (fixture.interact) {
      await act(async () => fixture.interact(container));
      await settle();
    }

    const template = document.createElement("template");
    template.innerHTML = readFileSync(join(domDir, `${name}.expected.html`), "utf8");
    const actual = canonical(container);
    const expected = canonical(template.content);

    await act(async () => root.unmount());
    container.remove();

    const mismatch = actual.findIndex((line, i) => line !== expected[i]);
    const at = mismatch === -1 && actual.length !== expected.length ? Math.min(actual.length, expected.length) : mismatch;
    if (at === -1 && consoleErrors.length === 0) {
      console.log(`ok   ${name} (${actual.length} nodes)`);
      continue;
    }
    failed += 1;
    console.log(`FAIL ${name}`);
    if (at !== -1) {
      console.log(`  first difference at line ${at + 1}:`);
      console.log(`  expected: ${expected[at] ?? "<end>"}`);
      console.log(`  actual:   ${actual[at] ?? "<end>"}`);
    }
    for (const e of consoleErrors) console.log(`  console.error: ${e.split("\n")[0]}`);
  }
  console.error = originalError;
  console.log(`${names.length - failed}/${names.length} fixtures match the Dioxus DOM`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
