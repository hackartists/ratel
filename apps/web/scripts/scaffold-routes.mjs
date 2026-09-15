// Creates a placeholder module for every page and layout in
// src/lib/route-tree.ts that doesn't have one yet. Never overwrites.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flattenRoutes } from "../src/lib/route-tree.ts";

const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

const pageStub = (name) => `// Placeholder for the Dioxus \`${name}\` route; ported in a later phase.
export function Component() {
  return null;
}
`;

const layoutStub = (file) => `import { Outlet } from "react-router-dom";

// Placeholder for the Dioxus layout \`${file}\`; ported in a later phase.
export function Component() {
  return <Outlet />;
}
`;

function create(path, content) {
  if (existsSync(path)) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return true;
}

let created = 0;
const routes = flattenRoutes();
for (const route of routes) {
  const file = route.pageDir === "" ? "pages/page.tsx" : `pages/${route.pageDir}/page.tsx`;
  if (create(resolve(src, file), pageStub(route.name))) created++;
}
for (const layout of new Set(routes.flatMap((r) => r.layouts))) {
  if (create(resolve(src, `layouts/${layout}.tsx`), layoutStub(layout))) created++;
}
console.log(`routes: ${routes.length}  created: ${created}`);
