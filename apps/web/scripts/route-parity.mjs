// Diffs the React route table (src/lib/route-tree.ts) against the Dioxus
// `Route` enum (app/ratel/src/route.rs): every variant must exist on both
// sides with the same URL shape, parameter names (snake_case ↔ camelCase)
// and layout chain, and every page must have a module. Exit 1 on any
// difference.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { matchRoutes } from "react-router-dom";
import { flattenRoutes, routeTree } from "../src/lib/route-tree.ts";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routeRs = readFileSync(resolve(web, "../../app/ratel/src/route.rs"), "utf8");

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
// `FactFoldAdminLayout` → `fact-fold-admin-layout`
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function dioxusRoutes(source) {
  const body = source.slice(source.indexOf("pub enum Route"));
  const nests = [];
  const layouts = [];
  let pending = null;
  const out = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^#\[layout\((\w+)\)\]/))) layouts.push(kebab(m[1]));
    else if (line.startsWith("#[end_layout]")) layouts.pop();
    else if ((m = line.match(/^#\[nest\("([^"]*)"\)\]/))) nests.push(m[1]);
    else if (line.startsWith("#[end_nest]")) nests.pop();
    else if ((m = line.match(/^#\[route\("([^"]*)"\)\]/))) pending = m[1];
    else if (pending !== null && (m = line.match(/^(\w+)\s*\{/))) {
      const joined = [...nests, pending.split("?")[0]]
        .flatMap((p) => p.split("/"))
        .filter(Boolean)
        .map((s) => (s.startsWith(":..") ? "*" : s.startsWith(":") ? `:${camel(s.slice(1))}` : s));
      out.push({ name: m[1], path: `/${joined.join("/")}`, layouts: [...layouts] });
      pending = null;
    }
  }
  return out;
}

const key = (r) => `${r.path}  [${r.layouts.join(" > ")}]`;
const dioxus = new Map(dioxusRoutes(routeRs).map((r) => [r.name, r]));
const react = flattenRoutes();
const reactByName = new Map(react.map((r) => [r.name, r]));

const problems = [];
for (const [name, d] of dioxus) {
  const r = reactByName.get(name);
  if (!r) problems.push(`missing in React: ${name} ${key(d)}`);
  else if (key(r) !== key(d)) problems.push(`differs: ${name}\n    dioxus ${key(d)}\n    react  ${key(r)}`);
}
for (const r of react) {
  if (!dioxus.has(r.name)) problems.push(`extra in React: ${r.name} ${key(r)}`);
  const file = resolve(web, "src/pages", r.pageDir, "page.tsx");
  if (!existsSync(file)) problems.push(`no page module: src/pages/${r.pageDir}/page.tsx (${r.name})`);
}
const paths = new Map();
for (const r of react) {
  if (paths.has(r.path)) problems.push(`duplicate path ${r.path}: ${paths.get(r.path)}, ${r.name}`);
  paths.set(r.path, r.name);
}

// Ranking: resolve a sample URL for every Dioxus route with React Router's
// own matcher over the real tree. Param values are placeholders that can't
// collide with a static segment, so e.g. `/:username/sub-teams/:subTeamId`
// must not swallow `/sample-username/sub-teams/manage`.
const toObjects = (node) => ({
  ...(node.index ? { index: true } : { path: node.path }),
  ...(node.name ? { id: node.name } : {}),
  ...(node.children ? { children: node.children.map(toObjects) } : {}),
});
const tree = [toObjects(routeTree)];
for (const d of dioxus.values()) {
  const url = d.path
    .split("/")
    .map((s) => (s === "*" ? "no/such/page" : s.startsWith(":") ? `sample-${s.slice(1)}` : s))
    .join("/");
  const matched = matchRoutes(tree, url)?.at(-1)?.route.id ?? "(no match)";
  if (matched !== d.name) problems.push(`ranking: ${url} resolves to ${matched}, Dioxus renders ${d.name}`);
}

console.log(`dioxus routes: ${dioxus.size}  react routes: ${react.length}  problems: ${problems.length}`);
for (const p of problems) console.log(`  ${p}`);
process.exit(problems.length ? 1 : 0);
