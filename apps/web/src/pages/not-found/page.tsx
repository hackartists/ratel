import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";

// The catch-all route — `PageNotFound` at the bottom of app/ratel/src/route.rs.
// The Rust component hardcodes English (no `translate!` block), so the text
// stays English in every language, exactly as in the Dioxus app.

/**
 * The `rest: Vec<String>` the Dioxus router hands the catch-all: the path
 * without one trailing slash, split on "/", each segment percent-decoded
 * (left raw when it is not valid UTF-8), minus the leading empty segment
 * (dioxus-router-macro 0.7 `FromStr for Route`).
 */
function routeSegments(pathname: string): string[] {
  const route = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return route
    .split("/")
    .slice(1)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

/** Rust `{:?}` of a `str`: double-quoted, with `char::escape_debug` escapes. */
function rustDebugString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\0") out += "\\0";
    else if (code < 0x20 || (code >= 0x7f && code < 0xa0)) out += `\\u{${code.toString(16)}}`;
    else out += ch;
  }
  return `${out}"`;
}

// Dev-only Playwright harness for the shared editor (no ported page renders it
// yet and the route table is frozen): `?__editor_harness=1` on any unknown
// path. `import.meta.env.DEV` is a literal `false` in production builds, so
// this branch and its dynamic import are removed from the bundle.
const EditorHarness = import.meta.env.DEV
  ? lazy(() => import("@/components/editor/__harness__/editor-harness"))
  : null;

export function Component() {
  const { pathname, search } = useLocation();
  if (EditorHarness && new URLSearchParams(search).get("__editor_harness") === "1") {
    return (
      <Suspense fallback={null}>
        <EditorHarness />
      </Suspense>
    );
  }
  const rest = `[${routeSegments(pathname).map(rustDebugString).join(", ")}]`;

  return (
    <>
      <h1>Page not found</h1>
      <p>We are terribly sorry, but the page you requested doesn't exist.</p>
      <pre style={{ color: "red" }}>{`log:\nattempted to navigate to: ${rest}`}</pre>
    </>
  );
}
