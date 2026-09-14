import { test, expect } from "@playwright/test";
import { goto } from "../utils";

// DOM parity between the Dioxus app and the React port
// (docs/superpower/2026-09-14-react-frontend-migration.md §8.3).
//
//   REACT_APP=1 PLAYWRIGHT_BASE_URL=http://localhost:4173 \
//   DIOXUS_BASE_URL=http://localhost:8080 \
//     npx playwright test tests/react/dom-parity.spec.js --project=React
//
// Each route loads in both apps; `#main` is serialized into a normalized tree
// and compared, so a failure prints a structural diff. A full-page screenshot
// of each app lands in the test's output dir under test-results/ for manual
// review (no pixel assertions). Read-only: page loads only.
//
// Add a route here once its page is ported.
//
// `/no/such/page?__notifications_harness=1` and `?__editor_harness=1` prove the
// dev-only harnesses (apps/web/src/pages/not-found/page.tsx) are compiled out of
// the production build: against `vite preview` the page must still equal Dioxus.
const ROUTES = [
  "/privacy",
  "/terms",
  "/child-safety",
  "/no/such/page",
  "/no/such/page?__notifications_harness=1",
  "/no/such/page?__editor_harness=1",
  "/me/character",
  // Signed out: the unverified hand-back card (no/invalid signature).
  "/launchpad/return",
  "/launchpad/return?project_id=p1&conversion_id=c1234567890abcdef&brand_tx_id=b1&deducted_points=1200&remaining_points=300&round_id=r1&community_url=https%3A%2F%2Fexample.com&ts=1&sig=bad",
  // Signed out: full interstitial with no connections.
  "/onboarding/connections",
  "/membership",
  // Signed out: the root error page in both apps (its loaders need a session).
  "/credentials",
];

const DIOXUS_BASE_URL = (process.env.DIOXUS_BASE_URL || "http://localhost:8080").replace(/\/$/, "");

/** Runs in the page: `#main` as a plain tree. */
function serializeMain() {
  // Dioxus bookkeeping attributes, not rendered output.
  const IGNORED_ATTRS = new Set(["data-dioxus-id", "data-node-hydration"]);
  const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE"]);
  const URL_ATTRS = new Set(["href", "src"]);

  // Hashed build assets differ per app: Dioxus `/assets/logo-dxh1a2b3c.png`,
  // Vite `/assets/logo-AbC123_x.png`. Compare by basename without the hash.
  const normalizeUrl = (value) => {
    if (!/(^|\/)assets\//.test(value)) return value;
    const base = value.split(/[?#]/)[0].split("/").pop();
    return base.replace(/-dxh[0-9a-f]+(?=\.[^.]+$)/, "").replace(/-[A-Za-z0-9_-]{8}(?=\.[^.]+$)/, "");
  };

  const attrsOf = (el) => {
    const out = {};
    for (const { name, value } of el.attributes) {
      if (IGNORED_ATTRS.has(name)) continue;
      if (name === "id" || name === "role") out[name] = value;
      else if (name === "class") out.class = value.split(/\s+/).filter(Boolean).join(" ");
      else if (name.startsWith("data-") || name.startsWith("aria-")) out[name] = value;
      // The browser's own serialization, so `color:red;` and `color: red` compare equal.
      else if (name === "style") out.style = el.style.cssText;
      else if (URL_ATTRS.has(name)) out[name] = normalizeUrl(value);
    }
    return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  };

  const walk = (el) => {
    const children = [];
    // Adjacent text nodes (Dioxus splits them around hydration comments)
    // count as one run.
    let text = "";
    const flush = () => {
      const trimmed = text.trim();
      if (trimmed) children.push(trimmed);
      text = "";
    };
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.data;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (SKIPPED_TAGS.has(node.tagName)) continue;
        flush();
        children.push(walk(node));
      }
      // Comments: skipped without breaking the text run.
    }
    flush();
    return { tag: el.tagName.toLowerCase(), attrs: attrsOf(el), children };
  };

  const main = document.getElementById("main");
  return main ? walk(main) : null;
}

const slug = (route) => route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "index";

test.describe("DOM parity: Dioxus vs React", () => {
  for (const route of ROUTES) {
    test(`#main matches on ${route}`, async ({ page, context }, testInfo) => {
      const dioxusPage = await context.newPage();
      try {
        await goto(dioxusPage, `${DIOXUS_BASE_URL}${route}`);
        await goto(page, route);

        const dioxus = await dioxusPage.evaluate(serializeMain);
        const react = await page.evaluate(serializeMain);

        await dioxusPage.screenshot({ path: testInfo.outputPath(`${slug(route)}-dioxus.png`), fullPage: true });
        await page.screenshot({ path: testInfo.outputPath(`${slug(route)}-react.png`), fullPage: true });

        expect(dioxus, "Dioxus #main").not.toBeNull();
        expect(react).toEqual(dioxus);
      } finally {
        await dioxusPage.close();
      }
    });
  }

  // Interactions that only open UI (no API calls): each clicks the same
  // `data-testid` in both apps, waits for the same element, then compares.
  const INTERACTIONS = [
    {
      name: "login modal opened from the arena topbar",
      route: "/me/character",
      click: "home-btn-drafts",
      waitFor: "email-input",
    },
  ];

  for (const { name, route, click, waitFor } of INTERACTIONS) {
    test(`#main matches on ${route} with the ${name}`, async ({ page, context }, testInfo) => {
      const dioxusPage = await context.newPage();
      try {
        for (const [p, url] of [
          [dioxusPage, `${DIOXUS_BASE_URL}${route}`],
          [page, route],
        ]) {
          await goto(p, url);
          await p.getByTestId(click).click();
          await expect(p.getByTestId(waitFor)).toBeVisible();
        }

        const dioxus = await dioxusPage.evaluate(serializeMain);
        const react = await page.evaluate(serializeMain);

        const shot = `${slug(route)}-${slug(name)}`;
        await dioxusPage.screenshot({ path: testInfo.outputPath(`${shot}-dioxus.png`), fullPage: true });
        await page.screenshot({ path: testInfo.outputPath(`${shot}-react.png`), fullPage: true });

        expect(dioxus, "Dioxus #main").not.toBeNull();
        expect(react).toEqual(dioxus);
      } finally {
        await dioxusPage.close();
      }
    });
  }
});
