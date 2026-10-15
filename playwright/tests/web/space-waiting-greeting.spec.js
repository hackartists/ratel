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
 * The admin opens "Greeting settings" from the space settings panel, which
 * leads to a full-page rich-text editor. Candidates who finished the
 * prerequisites see the greeting in place of the waiting card's icon and
 * heading; while it is empty the card keeps them. The participants count sits
 * on the same row as the waiting status either way. Once the space has started
 * the greeting page is read-only and the API rejects edits.
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
    const panel = page.locator('[data-testid="settings-panel"][data-open="true"]');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await expect(panel.getByTestId("greeting-settings-entry")).toBeVisible();
    await expect(panel.getByTestId("greeting-editor")).toHaveCount(0);
    return panel;
  }

  async function openGreetingSettings(page) {
    await clickNoNav(page, { testId: "settings-greeting" });
    await expect(page).toHaveURL(/\/settings\/greeting$/, { timeout: 15000 });
    await expect(page.getByTestId("greeting-settings-page")).toBeVisible({ timeout: 15000 });
  }

  async function expectParticipantsInlineWithStatus(card) {
    await card.page().evaluate(() => document.fonts.ready);
    const status = await card.getByTestId("waiting-status").boundingBox();
    const participants = await card.getByTestId("waiting-participants").boundingBox();
    const statusMid = status.y + status.height / 2;
    const participantsMid = participants.y + participants.height / 2;
    expect(Math.abs(statusMid - participantsMid)).toBeLessThanOrEqual(4);
    expect(participants.x).toBeGreaterThanOrEqual(status.x + status.width);
  }

  test.afterAll(async () => {
    if (candidate) await candidate.context.close();
  });

  test("Setup: space with a prerequisite poll, published", async ({ page }) => {
    space = await createSpaceWithEntryPoll(page, { title: `Waiting greeting ${stamp}` });
    await publishSpacePublic(page, space.spaceUrl);
  });

  test("Candidate: without a greeting the waiting card keeps its icon and heading", async ({ browser }) => {
    candidate = await signUpViaApi(browser, "greet");
    await joinAndAnswerViaApi(candidate.page, space.spaceId, space.pollId, [0, 0, 0]);
    const page = await openAsCandidate();
    const card = page.getByTestId("card-waiting");
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card.getByTestId("waiting-greeting")).toHaveCount(0);
    await expect(card.getByTestId("waiting-icon")).toBeVisible();
    await expect(card.getByTestId("waiting-heading")).toBeVisible();
    await expectParticipantsInlineWithStatus(card);
    await card.screenshot({ path: test.info().outputPath("greeting-waiting-card-empty.png"), animations: "disabled" });
  });

  test("Admin: edits the greeting on the full-page editor opened from the settings panel", async ({ page }) => {
    const panel = await openSettingsPanel(page);
    await expect(panel.getByTestId("settings-greeting")).toBeVisible();
    await panel.screenshot({ path: test.info().outputPath("greeting-settings-entry.png"), animations: "disabled" });
    await openGreetingSettings(page);
    await expect(page.getByTestId("greeting-save")).toBeDisabled();

    const editor = page.getByTestId("greeting-editor").locator("[contenteditable]");
    await expect(editor).toBeVisible();
    const box = await editor.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(640);
    expect(box.height).toBeGreaterThanOrEqual(320);

    await editor.click();
    await editor.fill(greetingText);
    await expect(page.getByTestId("greeting-save")).toBeEnabled({ timeout: 10000 });
    await expect(page.getByTestId("greeting-status")).toHaveAttribute("data-dirty", "true");
    await page.screenshot({ path: test.info().outputPath("greeting-settings-page.png"), animations: "disabled" });
    await clickNoNav(page, { testId: "greeting-save" });
    await expect(page.getByTestId("greeting-save")).toBeDisabled({ timeout: 15000 });
    await expect(page.getByTestId("greeting-status")).toHaveAttribute("data-dirty", "false");

    await expect
      .poll(async () => {
        const res = await page.request.get(`/api/spaces/${space.spaceId}`);
        return (await res.json()).greeting;
      })
      .toContain(greetingText);
  });

  test("Candidate: the greeting replaces the waiting card icon and heading", async () => {
    const page = await openAsCandidate();
    const card = page.getByTestId("card-waiting");
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card.getByTestId("waiting-greeting")).toContainText(greetingText);
    await expect(card.getByTestId("waiting-icon")).toHaveCount(0);
    await expect(card.getByTestId("waiting-heading")).toHaveCount(0);
    await expectParticipantsInlineWithStatus(card);
    await card.screenshot({ path: test.info().outputPath("greeting-waiting-card.png"), animations: "disabled" });
  });

  test("Admin: the greeting is read-only once the space has started", async ({ page }) => {
    await transitionSpace(page, space.spaceUrl, "start");

    const res = await page.request.patch(`/api/spaces/${space.spaceId}`, {
      data: { req: { greeting: "<p>Too late</p>" } },
    });
    expect(res.status()).toBe(400);

    await openSettingsPanel(page);
    await openGreetingSettings(page);
    await expect(page.getByTestId("greeting-locked-notice")).toBeVisible();
    await expect(page.getByTestId("greeting-editor")).toHaveAttribute("data-editable", "false");
    await expect(page.getByTestId("greeting-save")).toHaveCount(0);
    await expect(page.getByTestId("greeting-editor")).toContainText(greetingText);
  });
});
