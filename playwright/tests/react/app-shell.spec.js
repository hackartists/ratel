import { test, expect } from "@playwright/test";
import { goto, isReactApp } from "../utils";
import { flattenRoutes } from "../../../apps/web/src/lib/route-tree.ts";

// React app shell (apps/web), run against its build:
//   corepack pnpm -C apps/web build && corepack pnpm -C apps/web preview
//   REACT_APP=1 PLAYWRIGHT_BASE_URL=http://localhost:4173 npx playwright test --project=React
//
// Every route in the table loads, reaches the readiness signal the shared
// helpers wait on, raises no page errors, and gets the Dioxus stylesheets
// in the Dioxus order.

const sampleUrl = (path) =>
  path
    .split("/")
    .map((s) => (s === "*" ? "no/such/page" : s.startsWith(":") ? `sample-${s.slice(1)}` : s))
    .join("/");

test.describe("React app shell", () => {
  test("stylesheets load in the Dioxus order", async ({ page }) => {
    await goto(page, "/");
    const sheets = await page.evaluate(() =>
      [...document.styleSheets]
        .filter((s) => s.href && new URL(s.href).origin === location.origin)
        .map((s) => ({ path: new URL(s.href).pathname, rules: s.cssRules.length })),
    );
    expect(sheets.map((s) => s.path)).toEqual([
      "/assets/main.css",
      "/assets/dx-components-theme.css",
      "/_ratel/tailwind.css",
    ]);
    for (const sheet of sheets) expect(sheet.rules, sheet.path).toBeGreaterThan(0);
  });

  for (const route of flattenRoutes()) {
    const url = sampleUrl(route.path);
    test(`${route.name} ${url}`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await goto(page, url);

      expect(await isReactApp(page)).toBe(true);
      await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
      await expect(page.locator("#main")).toBeAttached();
      expect(errors).toEqual([]);
    });
  }
});
