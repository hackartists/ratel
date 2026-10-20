import { test, expect } from "@playwright/test";
import { goto, createSpaceWithEntryPoll, publishSpacePublic } from "../utils";

/**
 * Space landing Sign In vs. the creator badge.
 *
 * A signed-out visitor sees the welcome card with the Sign In button and the
 * floating "Space Creator" badge. On a short mobile viewport the badge used to
 * sit on top of the Sign In button; it now flows below the portal inside a
 * scrollable viewer, so the button is the topmost element at its own center
 * and the badge never overlaps the card. On desktop the badge stays pinned to
 * the bottom of the viewer.
 */
test.describe.serial("Space landing sign-in on mobile", () => {
  test.describe.configure({ timeout: 180000 });

  const stamp = Date.now();
  let space;

  async function openSignedOut(browser, viewport) {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport,
      isMobile: viewport.width < 500,
      hasTouch: viewport.width < 500,
    });
    const page = await context.newPage();
    await goto(page, space.spaceUrl);
    await page.addStyleTag({
      content: "*, *::before, *::after { animation: none !important; transition: none !important; }",
    });
    await expect(page.getByTestId("card-signin")).toBeVisible({ timeout: 30000 });
    return { context, page };
  }

  async function signinHitTest(page) {
    return page.evaluate(() => {
      const button = document.querySelector('[data-testid="btn-signin"]');
      const card = document.querySelector('[data-testid="card-signin"]');
      const badge = document.querySelector(".portal-author");
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        onButton: hit !== null && button.contains(hit),
        buttonBottom: rect.bottom,
        viewportHeight: window.innerHeight,
        cardBottom: card.getBoundingClientRect().bottom,
        badgeTop: badge.getBoundingClientRect().top,
        badgePosition: getComputedStyle(badge).position,
      };
    });
  }

  test("Setup: published public space", async ({ page }) => {
    space = await createSpaceWithEntryPoll(page, { title: `Landing sign-in ${stamp}` });
    await publishSpacePublic(page, space.spaceUrl);
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 390, height: 600 },
  ]) {
    test(`Mobile ${viewport.width}x${viewport.height}: Sign In is not covered by the creator badge`, async ({
      browser,
    }) => {
      const { context, page } = await openSignedOut(browser, viewport);
      const signin = page.getByTestId("btn-signin");
      await signin.scrollIntoViewIfNeeded();
      await expect(signin).toBeInViewport();

      const result = await signinHitTest(page);
      expect(result.onButton).toBe(true);
      expect(result.buttonBottom).toBeLessThanOrEqual(result.viewportHeight);
      expect(result.badgeTop).toBeGreaterThanOrEqual(result.cardBottom);

      await page.locator(".portal-author").scrollIntoViewIfNeeded();
      await expect(page.locator(".portal-author")).toBeInViewport();
      await context.close();
    });
  }

  test("Desktop: the creator badge stays pinned below the card", async ({ browser }) => {
    const { context, page } = await openSignedOut(browser, { width: 1440, height: 950 });
    const result = await signinHitTest(page);
    expect(result.onButton).toBe(true);
    expect(result.badgePosition).toBe("absolute");
    expect(result.badgeTop).toBeGreaterThanOrEqual(result.cardBottom);
    await context.close();
  });
});
