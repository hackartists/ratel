import { test, expect } from "@playwright/test";
import {
  clickNoNav,
  fill,
  goto,
  createSpaceWithEntryPoll,
  installSamplingApp,
  addRequiredAttribute,
  publishSpacePublic,
  transitionSpace,
  signUpViaApi,
  joinAndAnswerViaApi,
} from "../utils";

/**
 * Sampling app — settings, cell target preview, duplicate prevention
 * through a unique short-answer question, start gating and the
 * Open → Sampling → Ongoing status buttons.
 *
 * Creator: hi+user1@biyard.co (user.json). Requires a `bypass` backend.
 */
test.describe.serial("Sampling app settings and status flow", () => {
  test.describe.configure({ timeout: 180000 });

  const stamp = Date.now();
  let space;
  let unconfigured;
  const users = {};

  async function openAs(key) {
    const { page } = users[key];
    await goto(page, space.spaceUrl);
    await page.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; }" });
    return page;
  }

  test.afterAll(async () => {
    for (const { context } of Object.values(users)) {
      await context.close();
    }
  });

  test("A1: install the Sampling app and open its settings", async ({ page }) => {
    space = await createSpaceWithEntryPoll(page, { title: `Sampling settings ${stamp}` });
    await installSamplingApp(page, space.spaceUrl);

    await expect(page.getByTestId("sampling-allocation-equal")).toBeChecked();
    await expect(page.getByTestId("sampling-section-allocation")).toContainText("Allocation: Equal allocation");
    await expect(page.getByTestId("sampling-entry-poll-select")).toContainText(space.pollTitle);
  });

  test("A2: preview spreads the remainder over the leading groups", async ({ page }) => {
    await goto(page, `${space.spaceUrl}/apps/sampling`);
    await page.getByTestId("sampling-dimension-0").check();
    await page.getByTestId("sampling-dimension-1").check();
    await fill(page, { testId: "sampling-total-input" }, "7");

    await expect(page.getByTestId("sampling-cell-total")).toHaveText("7");
    for (const [pos, target] of [2, 2, 2, 1].entries()) {
      await expect(page.getByTestId(`sampling-cell-target-${pos}`)).toHaveText(String(target));
    }
    await expect(page.getByTestId("sampling-cell-label-0")).toHaveText("20s · Male");
    await expect(page.getByTestId("sampling-cell-label-3")).toHaveText("30s · Female");
  });

  test("A3/A4: change the total, add a rule, save and reload", async ({ page }) => {
    await goto(page, `${space.spaceUrl}/apps/sampling`);
    await page.getByTestId("sampling-dimension-0").check();
    await page.getByTestId("sampling-dimension-1").check();
    await fill(page, { testId: "sampling-total-input" }, "6");
    await expect(page.getByTestId("sampling-cell-total")).toHaveText("6");
    for (const [pos, target] of [2, 2, 1, 1].entries()) {
      await expect(page.getByTestId(`sampling-cell-target-${pos}`)).toHaveText(String(target));
    }

    await addRequiredAttribute(page, { pollTitle: space.pollTitle, questionTitle: "Resident", allowedValues: ["Yes"] });
    await page.getByTestId("sampling-method-first-come").check();
    await clickNoNav(page, { testId: "sampling-save" });
    await expect(page.getByTestId("sampling-dashboard")).toBeVisible({ timeout: 30000 });

    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("chip-required-attribute-0")).toContainText("Resident = Yes");
    await expect(page.getByTestId("sampling-total-input")).toHaveValue("6");
    await expect(page.getByTestId("sampling-dimension-1")).toBeChecked();
    await expect(page.getByTestId("sampling-method-first-come")).toBeChecked();
    await expect(page.getByTestId("sampling-cell-target-3")).toHaveText("1");
    await expect(page.getByTestId("sampling-dash-total-population")).toHaveText("0");
  });

  test("A4b: the sampling page scrolls on a desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 640 });
    await goto(page, `${space.spaceUrl}/apps/sampling`);
    await expect(page.getByTestId("sampling-dashboard")).toBeVisible();

    const arena = page.getByTestId("sampling-arena");
    const { scrollHeight, clientHeight } = await arena.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(scrollHeight).toBeGreaterThan(clientHeight);

    await page.mouse.move(720, 400);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => arena.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByTestId("topbar-back")).toBeInViewport();
  });

  test("A4c: a short-answer question can be picked for duplicate prevention", async ({ page }) => {
    await goto(page, `${space.spaceUrl}/apps/sampling`);
    await expect(page.getByTestId("sampling-no-short-answer")).toBeVisible();

    const pollRes = await page.request.get(`/api/spaces/${space.spaceId}/polls/${space.pollId}`);
    expect(pollRes.ok(), await pollRes.text()).toBeTruthy();
    const { questions } = await pollRes.json();
    const phone = { answer_type: "short_answer", title: "Phone", html_title: null, description: "", is_required: null, display_condition: null };
    const updateRes = await page.request.post(`/api/spaces/${space.spaceId}/polls/${space.pollId}`, {
      data: { req: { questions: [...questions, phone] } },
    });
    expect(updateRes.ok(), await updateRes.text()).toBeTruthy();

    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("sampling-section-unique")).toContainText("Duplicate prevention");
    await expect(page.getByTestId("sampling-no-short-answer")).toHaveCount(0);
    await expect(page.getByTestId("sampling-unique-question-0")).toHaveCount(0);
    const unique = page.getByTestId("sampling-unique-question-3");
    await expect(unique).not.toBeChecked();
    await unique.check();
    await clickNoNav(page, { testId: "sampling-save" });
    await expect(page.getByTestId("sampling-dashboard")).toBeVisible({ timeout: 30000 });

    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("sampling-unique-question-3")).toBeChecked();
    await expect(page.getByTestId("sampling-total-input")).toHaveValue("6");
  });

  test("A5: an unconfigured Sampling space cannot start or sample", async ({ page }) => {
    unconfigured = await createSpaceWithEntryPoll(page, { title: `Sampling unconfigured ${stamp}` });
    await installSamplingApp(page, unconfigured.spaceUrl);
    await publishSpacePublic(page, unconfigured.spaceUrl);

    await expect(page.getByTestId("btn-sampling")).toBeVisible();
    await expect(page.getByTestId("btn-start")).toHaveCount(0);

    await clickNoNav(page, { testId: "btn-sampling" });
    await clickNoNav(page, { testId: "sampling-space-button" });
    await expect(page.getByText("Save the Sampling settings before starting sampling.")).toBeVisible();
    await expect(page.getByTestId("btn-sampling")).toBeVisible();

    const res = await page.request.patch(`/api/spaces/${unconfigured.spaceId}`, { data: { req: { start: true } } });
    expect(res.status()).toBe(400);
  });

  test("A6: Open → Sampling swaps the Sampling button for Start", async ({ page, browser }) => {
    await publishSpacePublic(page, space.spaceUrl);
    const phones = { u1: "010-1234-5678", u2: "01012345678" };
    const picks = { u1: [0, 0, 0], u2: [1, 0, 0] };
    for (const key of Object.keys(phones)) {
      users[key] = await signUpViaApi(browser, key);
      await joinAndAnswerViaApi(users[key].page, space.spaceId, space.pollId, picks[key], [
        { answer_type: "short_answer", answer: phones[key] },
      ]);
    }
    await transitionSpace(page, space.spaceUrl, "sampling");
    await expect(page.getByTestId("btn-sampling")).toHaveCount(0);
    await expect(page.getByTestId("arena-topbar-status")).toHaveText("Sampling");
  });

  test("A6b: the same phone number in another format cannot enter twice", async () => {
    const first = await openAs("u1");
    await expect(first.getByTestId("sampling-state-can-enter")).toBeVisible({ timeout: 30000 });
    await clickNoNav(first, { testId: "btn-sampling-enter" });
    await expect(first.getByTestId("sampling-state-entered")).toBeVisible({ timeout: 30000 });

    const second = await openAs("u2");
    await expect(second.getByTestId("sampling-state-can-enter")).toBeVisible({ timeout: 30000 });
    await clickNoNav(second, { testId: "btn-sampling-enter" });
    await expect(second.getByText("This information has already been used to join the sample.")).toBeVisible({
      timeout: 30000,
    });
    await expect(second.getByTestId("sampling-state-can-enter")).toBeVisible();
  });

  test("A7: settings are locked once sampling started", async ({ page }) => {
    await goto(page, `${space.spaceUrl}/apps/sampling`);
    await expect(page.getByTestId("sampling-locked-notice")).toBeVisible();
    await expect(page.getByTestId("sampling-save")).toBeDisabled();
  });

  test("A8: Start moves Sampling → Ongoing", async ({ page }) => {
    await transitionSpace(page, space.spaceUrl, "start");
    await expect(page.getByTestId("btn-start")).toHaveCount(0);
    await expect(page.getByTestId("arena-topbar-status")).toHaveText("In Progress");
  });
});
