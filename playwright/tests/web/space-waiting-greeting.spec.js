import { test, expect } from "@playwright/test";
import {
  clickNoNav,
  goto,
  createSpaceWithEntryPoll,
  publishSpacePublic,
  signUpViaApi,
  joinAndAnswerViaApi,
  transitionSpace,
} from "../utils";

/**
 * Space waiting greeting.
 *
 * The admin writes a rich-text greeting at the top of the space settings
 * panel. Candidates who finished the prerequisites see it above the waiting
 * card heading; while it is empty the card is unchanged. Once the space has
 * started the greeting is read-only in the panel and the API rejects edits.
 */
test.describe.serial("Space waiting greeting", () => {
  test.describe.configure({ timeout: 180000 });

  const stamp = Date.now();
  const greetingText = `Welcome aboard ${stamp}, the space opens soon.`;
  let space;
  let candidate;

  async function openAsCandidate() {
    const { page } = candidate;
    await goto(page, space.spaceUrl);
    await page.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; }" });
    return page;
  }

  async function openSettingsPanel(page) {
    await goto(page, space.spaceUrl);
    await clickNoNav(page, { testId: "btn-settings" });
    await expect(page.locator('[data-testid="settings-panel"][data-open="true"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("greeting-section")).toBeVisible();
  }

  test.afterAll(async () => {
    if (candidate) await candidate.context.close();
  });

  test("Setup: space with a prerequisite poll, published", async ({ page }) => {
    space = await createSpaceWithEntryPoll(page, { title: `Waiting greeting ${stamp}` });
    await publishSpacePublic(page, space.spaceUrl);
  });

  test("Candidate: without a greeting the waiting card is unchanged", async ({ browser }) => {
    candidate = await signUpViaApi(browser, "greet");
    await joinAndAnswerViaApi(candidate.page, space.spaceId, space.pollId, [0, 0, 0]);
    const page = await openAsCandidate();
    await expect(page.getByTestId("card-waiting")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("waiting-greeting")).toHaveCount(0);
  });

  test("Admin: writes the greeting at the top of the settings panel", async ({ page }) => {
    await openSettingsPanel(page);
    const section = page.getByTestId("greeting-section");
    await expect(page.locator(".settings-panel__body > :first-child")).toHaveAttribute("data-testid", "greeting-section");
    await expect(page.getByTestId("greeting-save")).toBeDisabled();

    const editor = page.getByTestId("greeting-editor").locator("[contenteditable]");
    await expect(editor).toBeVisible();
    await editor.click();
    await editor.fill(greetingText);
    await expect(page.getByTestId("greeting-save")).toBeEnabled({ timeout: 10000 });
    await section.screenshot({ path: test.info().outputPath("greeting-settings-section.png"), animations: "disabled" });
    await clickNoNav(page, { testId: "greeting-save" });
    await expect(page.getByTestId("greeting-save")).toBeDisabled({ timeout: 15000 });

    await expect
      .poll(async () => {
        const res = await page.request.get(`/api/spaces/${space.spaceId}`);
        return (await res.json()).greeting;
      })
      .toContain(greetingText);
  });

  test("Candidate: sees the greeting above the waiting card heading", async () => {
    const page = await openAsCandidate();
    const card = page.getByTestId("card-waiting");
    await expect(card).toBeVisible({ timeout: 30000 });
    const greeting = card.getByTestId("waiting-greeting");
    await expect(greeting).toContainText(greetingText);
    const greetingBox = await greeting.boundingBox();
    const headingBox = await card.locator(".waiting-card__heading").boundingBox();
    expect(greetingBox.y + greetingBox.height).toBeLessThanOrEqual(headingBox.y);
    await card.screenshot({ path: test.info().outputPath("greeting-waiting-card.png"), animations: "disabled" });
  });

  test("Admin: the greeting is locked once the space has started", async ({ page }) => {
    await transitionSpace(page, space.spaceUrl, "start");

    const res = await page.request.patch(`/api/spaces/${space.spaceId}`, {
      data: { req: { greeting: "<p>Too late</p>" } },
    });
    expect(res.status()).toBe(400);

    await openSettingsPanel(page);
    await expect(page.getByTestId("greeting-editor")).toHaveAttribute("data-editable", "false");
    await expect(page.getByTestId("greeting-save")).toHaveCount(0);
    await expect(page.getByTestId("greeting-section")).toContainText(greetingText);
  });
});
