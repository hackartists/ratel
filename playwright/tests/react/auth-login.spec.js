import { test, expect } from "@playwright/test";
import { clickNoNav, fill, goto, waitPopup } from "../utils";

// Sign-in through the ported LoginModal (apps/web/src/components/auth), from
// the arena topbar on /me/character. Needs a backend built with `bypass`
// (verification code "000000") that has the seeded `hi+user1@biyard.co`:
//
//   VITE_API_TARGET=http://localhost:8080 corepack pnpm -C apps/web exec vite preview --port 4174 --strictPort
//   REACT_APP=1 PLAYWRIGHT_BASE_URL=http://localhost:4174 npx playwright test tests/react/auth-login.spec.js --project=React

const EMAIL = "hi+user1@biyard.co";
const CODE = "000000";

test.describe.serial("React login modal", () => {
  test("signs in with an email code from the arena topbar", async ({ page }) => {
    await goto(page, "/me/character");

    // Signed out: a topbar button opens the login modal instead of navigating.
    await clickNoNav(page, { testId: "home-btn-drafts" });
    await waitPopup(page, { visible: true });
    await expect(page.getByText("Start building your Essence", { exact: true })).toBeVisible();
    await expect(page.getByTestId("code-input")).toBeHidden();

    // Step 1: send the code, which reveals the code field.
    await fill(page, { testId: "email-input" }, EMAIL);
    await clickNoNav(page, { testId: "continue-button" });
    await expect(page.getByTestId("code-input")).toBeVisible();

    // Step 2: verify + log in. The character loader re-runs for the signed-in user.
    await fill(page, { testId: "code-input" }, CODE);
    const characterLoaded = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/me/character" && r.request().method() === "GET",
    );
    await clickNoNav(page, { testId: "continue-button" });
    await waitPopup(page, { visible: false });
    expect((await characterLoaded).status()).toBe(200);

    // Signed in: the same button now navigates to the user's drafts.
    await clickNoNav(page, { testId: "home-btn-drafts" });
    await page.waitForURL(/\/[^/]+\/drafts$/);
    await waitPopup(page, { visible: false });
  });
});
