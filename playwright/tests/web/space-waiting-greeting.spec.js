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
 * on the same row as the waiting status either way. The greeting is typed as
 * rich text the way an admin would (markdown shortcuts for the heading and the
 * list, Cmd/Ctrl+B and Cmd/Ctrl+I for inline marks) and the card renders those
 * elements. The space also carries an announcement, linked above the waiting
 * card while the greeting is empty and hidden once a greeting is shown. A long
 * greeting keeps the card inside the viewport: the space logo, title and
 * status step aside, the card spans at least half the viewport and only the
 * greeting scrolls. Once the space has started the
 * greeting page is read-only and the API rejects edits.
 */
test.describe.serial("Space waiting greeting", () => {
  test.describe.configure({ timeout: 180000 });

  const stamp = Date.now();
  const greeting = {
    heading: "환영합니다!",
    lead: `스페이스 ${stamp} 에 참여해 주셔서 감사합니다. `,
    bold: "시작 10분 전",
    middle: "까지 입장해 주시고, ",
    italic: "아래 안내",
    tail: "를 확인해 주세요.",
    items: ["시작 일시: 10월 20일 오후 2시", "준비물: 노트북과 이어폰", "문의: support@ratel.foundation"],
  };
  const announcementTitle = `연구대상자를 위한 설명서 ${stamp}`;
  const greetingText = `${greeting.lead}${greeting.bold}${greeting.middle}${greeting.italic}${greeting.tail}`;
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

  async function typeRichGreeting(page, editor) {
    await editor.click();
    await page.keyboard.type(`## ${greeting.heading}`);
    await page.keyboard.press("Enter");
    await page.keyboard.type(greeting.lead);
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type(greeting.bold);
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type(greeting.middle);
    await page.keyboard.press("ControlOrMeta+i");
    await page.keyboard.type(greeting.italic);
    await page.keyboard.press("ControlOrMeta+i");
    await page.keyboard.type(greeting.tail);
    await page.keyboard.press("Enter");
    await page.keyboard.type(`- ${greeting.items[0]}`);
    for (const item of greeting.items.slice(1)) {
      await page.keyboard.press("Enter");
      await page.keyboard.type(item);
    }
  }

  async function expectRichGreeting(root) {
    await expect(root.locator("h2")).toHaveText(greeting.heading);
    await expect(root.locator(":is(strong, b)")).toHaveText(greeting.bold);
    await expect(root.locator(":is(em, i)")).toHaveText(greeting.italic);
    await expect(root.locator("ul > li")).toHaveText(greeting.items);
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

  test("Setup: space with a prerequisite poll and an announcement, published", async ({ page }) => {
    space = await createSpaceWithEntryPoll(page, { title: `Waiting greeting ${stamp}` });
    const created = await page.request.post(`/api/spaces/${space.spaceId}/announcements`);
    expect(created.ok(), `create announcement: ${await created.text()}`).toBeTruthy();
    const { action_id } = await created.json();
    for (const req of [{ title: announcementTitle }, { status: "Ongoing" }]) {
      const res = await page.request.post(`/api/spaces/${space.spaceId}/actions/${action_id}`, { data: { req } });
      expect(res.ok(), `update announcement: ${await res.text()}`).toBeTruthy();
    }
    await publishSpacePublic(page, space.spaceUrl);
  });

  test("Candidate: without a greeting the waiting card keeps its icon and heading", async ({ browser }) => {
    candidate = await signUpViaApi(browser, "greet");
    await joinAndAnswerViaApi(candidate.page, space.spaceId, space.pollId, [0, 0, 0]);
    const page = await openAsCandidate();
    const card = page.getByTestId("card-waiting");
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card.getByTestId("waiting-greeting")).toHaveCount(0);
    await expect(page.getByTestId("candidate-announcement-link")).toContainText(announcementTitle);
    await expect(page.getByTestId("candidate-announcement-link")).toBeVisible();
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

    await typeRichGreeting(page, editor);
    await expectRichGreeting(editor);
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
      .toMatch(/<h2[^>]*>[\s\S]*<ul[^>]*>[\s\S]*<li/);
  });

  test("Candidate: the greeting replaces the waiting card icon and heading", async () => {
    const page = await openAsCandidate();
    const card = page.getByTestId("card-waiting");
    await expect(card).toBeVisible({ timeout: 30000 });
    const rendered = card.getByTestId("waiting-greeting");
    await expect(rendered).toContainText(greetingText);
    await expectRichGreeting(rendered);
    await expect(page.getByTestId("candidate-announcement-link")).toBeHidden();
    const headingSize = await rendered.locator("h2").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const bodySize = await rendered.locator("li").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(headingSize).toBeGreaterThan(bodySize);
    const boldWeight = await rendered.locator(":is(strong, b)").evaluate((el) => Number(getComputedStyle(el).fontWeight));
    expect(boldWeight).toBeGreaterThanOrEqual(600);
    await expect(rendered.locator("ul")).toHaveCSS("list-style-type", "disc");
    await expect(card.getByTestId("waiting-icon")).toHaveCount(0);
    await expect(card.getByTestId("waiting-heading")).toHaveCount(0);
    await expectParticipantsInlineWithStatus(card);
    await card.screenshot({ path: test.info().outputPath("greeting-waiting-card.png"), animations: "disabled" });
  });

  test("Candidate: a long greeting scrolls inside a wide card that fits the viewport", async ({ page }) => {
    const current = await page.request.get(`/api/spaces/${space.spaceId}`);
    const original = (await current.json()).greeting;
    const paragraphs = Array.from({ length: 60 }, (_, i) => `<p>안내 문단 ${i + 1}: 조사 참여 전 반드시 확인해 주세요.</p>`);
    const longGreeting = `<h2>${greeting.heading}</h2>${paragraphs.join("")}`;
    const patch = (value) => page.request.patch(`/api/spaces/${space.spaceId}`, { data: { req: { greeting: value } } });

    const res = await patch(longGreeting);
    expect(res.ok(), await res.text()).toBeTruthy();
    try {
      const view = await openAsCandidate();
      const card = view.getByTestId("card-waiting");
      const rendered = card.getByTestId("waiting-greeting");
      await expect(rendered).toContainText("안내 문단 60", { timeout: 30000 });
      await expect(view.getByTestId("portal-header")).toBeHidden();
      await expect(view.getByTestId("portal-status")).toBeHidden();
      await expect(view.getByTestId("candidate-announcement-link")).toBeHidden();

      const viewport = view.viewportSize();
      const viewer = await view.getByTestId("arena-viewer").boundingBox();
      const box = await card.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(Math.min(viewport.width * 0.5, viewer.width - 32) - 1);
      expect(box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

      await expect(rendered).toHaveCSS("overflow-y", "auto");
      const scroll = await rendered.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
      expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
      await expect(card.getByTestId("waiting-status")).toBeInViewport();

      await rendered.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await expect(rendered.getByText("안내 문단 60")).toBeInViewport();
      await view.screenshot({ path: test.info().outputPath("greeting-waiting-card-long.png"), animations: "disabled" });
    } finally {
      const restore = await patch(original);
      expect(restore.ok(), await restore.text()).toBeTruthy();
    }
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
    await expectRichGreeting(page.getByTestId("greeting-editor"));
  });
});
