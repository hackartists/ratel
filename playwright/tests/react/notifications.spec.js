import { test, expect } from "@playwright/test";
import { clickNoNav, fill, goto, waitPopup } from "../utils";

// Notifications bootstrap in the React app (apps/web/src/components/notifications):
// unread-count polling only while signed in, and the NotificationBell /
// NotificationPanel pair. Needs a backend built with `bypass` (code "000000")
// that has the seeded `hi+user1@biyard.co`. Read-only: nothing is marked read.
//
//   VITE_API_TARGET=http://localhost:8080 corepack pnpm -C apps/web exec vite preview --port 4187 --strictPort
//   REACT_APP=1 PLAYWRIGHT_BASE_URL=http://localhost:4187 npx playwright test tests/react/notifications.spec.js --project=React
//
// No ported page shows the bell yet, so the panel checks use the dev-only
// harness on the 404 page (`?__notifications_harness=1`) and need `vite dev`:
//
//   VITE_API_TARGET=http://localhost:8080 corepack pnpm -C apps/web exec vite dev --port 5187 --strictPort
//   REACT_APP=1 PLAYWRIGHT_BASE_URL=http://localhost:5187 npx playwright test tests/react/notifications.spec.js --project=React
//
// Against a production build the same test asserts the harness is absent.

const EMAIL = "hi+user1@biyard.co";
const CODE = "000000";
const HARNESS = "/no/such/page?__notifications_harness=1";

const isGet = (response, pathname) =>
  new URL(response.url()).pathname === pathname && response.request().method() === "GET";

/** `vite dev` injects its client; production builds don't. */
async function isViteDev(page) {
  return page.evaluate(() => document.querySelector('script[src="/@vite/client"]') !== null);
}

/** Signs in through the LoginModal on /me/character and returns the first unread-count response. */
async function signIn(page) {
  await goto(page, "/me/character");
  await clickNoNav(page, { testId: "home-btn-drafts" });
  await waitPopup(page, { visible: true });
  await fill(page, { testId: "email-input" }, EMAIL);
  await clickNoNav(page, { testId: "continue-button" });
  await expect(page.getByTestId("code-input")).toBeVisible();
  await fill(page, { testId: "code-input" }, CODE);
  const unreadCount = page.waitForResponse((r) => isGet(r, "/api/inbox/unread-count"));
  await clickNoNav(page, { testId: "continue-button" });
  await waitPopup(page, { visible: false });
  return unreadCount;
}

test.describe.serial("React notifications", () => {
  test("fetches the unread count only once signed in", async ({ page }) => {
    const polled = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/inbox")) polled.push(request.url());
    });

    const unreadCount = signIn(page);
    // The login modal is up, the user still signed out: no inbox traffic yet.
    await expect(page.getByTestId("code-input")).toBeVisible();
    expect(polled).toEqual([]);

    const response = await unreadCount;
    expect(response.status()).toBe(200);
    // The global (root-layout) scope sends no space filter.
    expect(new URL(response.url()).searchParams.has("space_id")).toBe(false);
    expect(typeof (await response.json()).count).toBe("number");
  });

  test("opens the NotificationPanel from the bell", async ({ page }) => {
    await (await signIn(page)).finished();

    const inboxLoaded = page.waitForResponse((r) => isGet(r, "/api/inbox"), { timeout: 15000 });
    await goto(page, HARNESS);

    if (!(await isViteDev(page))) {
      inboxLoaded.catch(() => {});
      // Production build: the harness is compiled out and the 404 is untouched.
      await expect(page.getByText("Page not found", { exact: true })).toBeVisible();
      await expect(page.getByTestId("notification-bell")).toHaveCount(0);
      await expect(page.getByTestId("notification-panel")).toHaveCount(0);
      return;
    }

    const inbox = await (await inboxLoaded).json();
    const panel = page.getByTestId("notification-panel");
    await expect(panel).toHaveAttribute("data-open", "false");

    await clickNoNav(page, { testId: "notification-bell" });
    await expect(panel).toHaveAttribute("data-open", "true");
    await expect(panel.getByTestId("mark-all-read")).toBeVisible();

    const items = panel.getByTestId("notification-item");
    if (inbox.items.length === 0) {
      await expect(panel.getByText("No notifications yet", { exact: true })).toBeVisible();
    } else if (inbox.bookmark === null) {
      await expect(items).toHaveCount(inbox.items.length);
      const unread = inbox.items.filter((item) => !item.is_read).length;
      await expect(panel.getByTestId("unread-dot")).toHaveCount(unread);
    } else {
      await expect(items.nth(inbox.items.length - 1)).toBeAttached();
    }

    await clickNoNav(page, { label: "Close" });
    await expect(panel).toHaveAttribute("data-open", "false");
  });

  test("a space scope filters the count and the inbox", async ({ page }) => {
    await (await signIn(page)).finished();

    const spaceId = "00000000-0000-0000-0000-000000000000";
    const scopedCount = page.waitForResponse(
      (r) => isGet(r, "/api/inbox/unread-count") && new URL(r.url()).searchParams.get("space_id") === spaceId,
      { timeout: 15000 },
    );
    const scopedInbox = page.waitForResponse(
      (r) => isGet(r, "/api/inbox") && new URL(r.url()).searchParams.get("space_id") === spaceId,
      { timeout: 15000 },
    );
    await goto(page, `${HARNESS}&space_id=${spaceId}`);

    if (!(await isViteDev(page))) {
      scopedCount.catch(() => {});
      scopedInbox.catch(() => {});
      test.skip(true, "the space-scoped harness only exists in `vite dev`");
      return;
    }

    expect((await scopedCount).status()).toBe(200);
    const inbox = await (await scopedInbox).json();
    await clickNoNav(page, { testId: "notification-bell" });
    const panel = page.getByTestId("notification-panel");
    await expect(panel).toHaveAttribute("data-open", "true");
    if (inbox.items.length === 0) {
      await expect(panel.getByText("No notifications yet", { exact: true })).toBeVisible();
    }
  });
});
