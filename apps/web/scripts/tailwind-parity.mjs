// Checks that the React app's Tailwind output contains every selector the
// Dioxus app's Tailwind output does (docs/superpower/2026-09-14-react-frontend-migration.md §3.1).
//
// Baseline: the Dioxus input (`app/ratel/tailwind.css`, scanning only `.rs`)
// compiled by the same pinned CLI. Candidate: `apps/web/.cache/tailwind.css`.
// Exit 1 when the candidate is missing any baseline selector.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");
const baselineOut = resolve(web, ".cache/tailwind-baseline.css");
const candidateOut = resolve(web, ".cache/tailwind.css");

// Module resolution, not node_modules/.bin: `.npmrc` sets node-linker=hoisted.
const require = createRequire(import.meta.url);
const cliPkgPath = require.resolve("@tailwindcss/cli/package.json");
const cliPkg = JSON.parse(readFileSync(cliPkgPath, "utf8"));
const cli = resolve(dirname(cliPkgPath), typeof cliPkg.bin === "string" ? cliPkg.bin : cliPkg.bin.tailwindcss);
const run = (input, output) =>
  execFileSync(process.execPath, [cli, "-i", input, "-o", output], { stdio: "inherit" });

mkdirSync(dirname(baselineOut), { recursive: true });
run(resolve(web, "../../app/ratel/tailwind.css"), baselineOut);
run(resolve(web, "src/styles/tailwind.css"), candidateOut);

function selectors(css) {
  const out = new Set();
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(noComments))) {
    const prelude = m[1].trim().replace(/\s+/g, " ");
    if (!prelude || prelude.startsWith("@")) continue;
    for (const s of prelude.split(",")) out.add(s.trim());
  }
  return out;
}

const base = selectors(readFileSync(baselineOut, "utf8"));
const cand = selectors(readFileSync(candidateOut, "utf8"));
const missing = [...base].filter((s) => !cand.has(s));
const extra = [...cand].filter((s) => !base.has(s));

console.log(`baseline selectors: ${base.size}  candidate: ${cand.size}`);
console.log(`missing from React build: ${missing.length}  extra in React build: ${extra.length}`);
if (missing.length) console.log("first missing:", missing.slice(0, 20));
if (extra.length) console.log("first extra:", extra.slice(0, 20));
process.exit(missing.length ? 1 : 0);
