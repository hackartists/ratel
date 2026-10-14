import { test, expect } from "@playwright/test";
import {
  clickNoNav,
  goto,
  createSpaceWithEntryPoll,
  installSamplingApp,
  configureSampling,
  publishSpacePublic,
  signUpViaApi,
  joinAndAnswerViaApi,
  transitionSpace,
} from "../utils";

/**
 * Sampling app — first come, first served, recruiting allowed during
 * sampling, late joining off.
 *
 * Population rule Resident = Yes, sampling items age × gender, N = 6
 * (targets 2, 2, 1, 1). U1 (20s, Male), U2 and U3 (30s, Male) qualify; U4
 * (Resident = No) does not. U5 joins during sampling (30s, Female).
 */
test.describe.serial("Sampling app — first come", () => {
  test.describe.configure({ timeout: 180000 });

  const stamp = Date.now();
  const greeting = `Thanks for joining the sample ${stamp}`;
  let space;
  const users = {};

  async function openAs(key, url) {
    const { page } = users[key];
    await goto(page, url ?? space.spaceUrl);
    await page.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; }" });
    return page;
  }

  test.afterAll(async () => {
    for (const { context } of Object.values(users)) {
      await context.close();
    }
  });

  test("Setup: entry poll, settings, join_anytime off, publish, population", async ({ page, browser }) => {
    space = await createSpaceWithEntryPoll(page, { title: `Sampling first come ${stamp}` });
    await installSamplingApp(page, space.spaceUrl);
    await configureSampling(page, {
      rules: [{ pollTitle: space.pollTitle, questionTitle: "Resident", allowedValues: ["Yes"] }],
      dims: [0, 1],
      total: 6,
      method: "first-come",
      recruit: true,
    });
    const res = await page.request.patch(`/api/spaces/${space.spaceId}`, { data: { req: { join_anytime: false } } });
    expect(res.ok(), await res.text()).toBeTruthy();
    const greetingRes = await page.request.patch(`/api/spaces/${space.spaceId}`, {
      data: { req: { greeting: `<p>${greeting}</p>` } },
    });
    expect(greetingRes.ok(), await greetingRes.text()).toBeTruthy();
    await publishSpacePublic(page, space.spaceUrl);

    const answers = { u1: [0, 0, 0], u2: [1, 0, 0], u3: [1, 0, 0], u4: [0, 1, 1] };
    for (const [key, picks] of Object.entries(answers)) {
      users[key] = await signUpViaApi(browser, key);
      await joinAndAnswerViaApi(users[key].page, space.spaceId, space.pollId, picks);
    }
  });

  test("B1: a population member waits while the space is open", async () => {
    const page = await openAs("u1");
    await expect(page.getByTestId("card-sampling")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("sampling-state-waiting")).toBeVisible();
    await expect(page.getByTestId("card-sampling").getByTestId("waiting-greeting")).toHaveText(greeting);
  });

  test("B2: a respondent outside the population is told so", async () => {
    const page = await openAs("u4");
    await expect(page.getByTestId("sampling-state-not-eligible")).toHaveText(
      "You do not meet the population conditions, so you cannot take part in this space.",
    );
    await expect(page.getByTestId("btn-sampling-enter")).toHaveCount(0);
    await expect(page.getByTestId("card-sampling").getByTestId("waiting-greeting")).toHaveText(greeting);
  });

  test("B3: the open dashboard flags population shortages", async ({ page }) => {
    await goto(page, `${space.spaceUrl}/apps/sampling`);
    await expect(page.getByTestId("sampling-dash-0-target")).toHaveText("2");
    await expect(page.getByTestId("sampling-dash-0-population")).toHaveText("1");
    await expect(page.getByTestId("sampling-dash-2-target")).toHaveText("1");
    await expect(page.getByTestId("sampling-dash-2-population")).toHaveText("2");
    await expect(page.getByTestId("sampling-dash-1-population")).toHaveText("0");
    await expect(page.getByTestId("sampling-dash-3-population")).toHaveText("0");
    for (const pos of [0, 1, 3]) {
      await expect(page.getByTestId(`sampling-badge-shortage-${pos}`)).toBeVisible();
    }
    await expect(page.getByTestId("sampling-badge-shortage-2")).toHaveCount(0);
  });

  test("B4: Open → Sampling", async ({ page }) => {
    await transitionSpace(page, space.spaceUrl, "sampling");
    await expect(page.getByTestId("arena-topbar-status")).toHaveText("Sampling");
  });

  test("B5: the first member of a group takes its seat", async () => {
    const page = await openAs("u2");
    await expect(page.getByTestId("sampling-state-can-enter")).toBeVisible({ timeout: 30000 });
    await clickNoNav(page, { testId: "btn-sampling-enter" });
    await expect(page.getByTestId("sampling-state-entered")).toBeVisible({ timeout: 30000 });
  });

  test("B6: the next member of a full group cannot enter", async () => {
    const page = await openAs("u3");
    await expect(page.getByTestId("sampling-state-cell-full")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("btn-sampling-enter")).toHaveCount(0);
    const res = await page.request.post(`/api/spaces/${space.spaceId}/sampling/enter`);
    expect(res.status()).toBe(400);
  });

  test("B7: a member of a group with free seats enters", async () => {
    const page = await openAs("u1");
    await clickNoNav(page, { testId: "btn-sampling-enter" });
    await expect(page.getByTestId("sampling-state-entered")).toBeVisible({ timeout: 30000 });
  });

  test("B8: recruiting during sampling lets a newcomer join and enter", async ({ browser }) => {
    users.u5 = await signUpViaApi(browser, "u5");
    const page = await openAs("u5");
    await expect(page.getByTestId("btn-participate")).toBeVisible({ timeout: 30000 });
    await joinAndAnswerViaApi(page, space.spaceId, space.pollId, [1, 1, 0]);
    await page.reload({ waitUntil: "load" });
    await page.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; }" });
    await expect(page.getByTestId("sampling-state-can-enter")).toBeVisible({ timeout: 30000 });
    await clickNoNav(page, { testId: "btn-sampling-enter" });
    await expect(page.getByTestId("sampling-state-entered")).toBeVisible({ timeout: 30000 });
  });

  test("B9: the sampling dashboard shows seats taken per group", async ({ page }) => {
    await goto(page, `${space.spaceUrl}/apps/sampling`);
    await clickNoNav(page, { testId: "sampling-dashboard-refresh" });
    await expect(page.getByTestId("sampling-dash-0-entered")).toHaveText("1");
    await expect(page.getByTestId("sampling-badge-shortage-0")).toBeVisible();
    await expect(page.getByTestId("sampling-dash-2-population")).toHaveText("2");
    await expect(page.getByTestId("sampling-dash-2-entered")).toHaveText("1");
    await expect(page.getByTestId("sampling-badge-filled-2")).toBeVisible();
    await expect(page.getByTestId("sampling-dash-3-entered")).toHaveText("1");
    await expect(page.getByTestId("sampling-badge-filled-3")).toBeVisible();
    await expect(page.getByTestId("sampling-dash-total-entered")).toHaveText("3");
    await expect(page.getByTestId("sampling-dash-0-selected")).toHaveCount(0);
  });

  test("B10: after Start an entered member reaches the action dashboard", async ({ page }) => {
    await transitionSpace(page, space.spaceUrl, "start");
    const member = await openAs("u1");
    await expect(member.getByTestId("quest-label")).toBeVisible({ timeout: 30000 });
  });

  test("B11: a population member who never entered is closed out", async () => {
    const page = await openAs("u3");
    await expect(page.getByTestId("sampling-state-sample-closed")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("quest-label")).toHaveCount(0);
  });

  test("B12: newcomers cannot join once the space is ongoing", async ({ browser }) => {
    users.u6 = await signUpViaApi(browser, "u6");
    const page = await openAs("u6");
    await expect(page.getByTestId("space-index-page")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("btn-participate")).toHaveCount(0);
  });
});
