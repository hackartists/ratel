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
 * Sampling app — random draw, recruiting closed during sampling, late
 * joining on.
 *
 * Population rule Resident = Yes, sampling item age, N = 3 (targets 20s = 2,
 * 30s = 1). R1 and R2 (30s) compete for one seat, R3 (20s) is the only 20s
 * member, R4 joins but never answers the entry poll.
 */
test.describe.serial("Sampling app — random", () => {
  test.describe.configure({ timeout: 180000 });

  const stamp = Date.now();
  let space;
  const users = {};
  let selectedKey;
  let notSelectedKey;

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

  test("C1: settings preview targets 2 and 1", async ({ page, browser }) => {
    space = await createSpaceWithEntryPoll(page, { title: `Sampling random ${stamp}` });
    await installSamplingApp(page, space.spaceUrl);
    await configureSampling(page, {
      rules: [{ pollTitle: space.pollTitle, questionTitle: "Resident", allowedValues: ["Yes"] }],
      dims: [0],
      total: 3,
      method: "random",
      recruit: false,
    });
    await expect(page.getByTestId("sampling-cell-target-0")).toHaveText("2");
    await expect(page.getByTestId("sampling-cell-target-1")).toHaveText("1");
    await publishSpacePublic(page, space.spaceUrl);

    const answers = { r1: [1, 0, 0], r2: [1, 1, 0], r3: [0, 0, 0] };
    for (const [key, picks] of Object.entries(answers)) {
      users[key] = await signUpViaApi(browser, key);
      await joinAndAnswerViaApi(users[key].page, space.spaceId, space.pollId, picks);
    }
    users.r4 = await signUpViaApi(browser, "r4");
    const join = await users.r4.page.request.post(`/api/spaces/${space.spaceId}/participate`, {
      data: { body: { informed_agreed: true } },
    });
    expect(join.ok(), await join.text()).toBeTruthy();
  });

  test("C2: starting sampling draws each group at random", async ({ page }) => {
    await transitionSpace(page, space.spaceUrl, "sampling");
    await goto(page, `${space.spaceUrl}/apps/sampling`);
    await expect(page.getByTestId("sampling-dash-0-target")).toHaveText("2");
    await expect(page.getByTestId("sampling-dash-0-population")).toHaveText("1");
    await expect(page.getByTestId("sampling-dash-0-selected")).toHaveText("1");
    await expect(page.getByTestId("sampling-badge-shortage-0")).toBeVisible();
    await expect(page.getByTestId("sampling-dash-1-target")).toHaveText("1");
    await expect(page.getByTestId("sampling-dash-1-population")).toHaveText("2");
    await expect(page.getByTestId("sampling-dash-1-selected")).toHaveText("1");
    await expect(page.getByTestId("sampling-badge-filled-1")).toHaveCount(0);
  });

  test("C3: exactly one of the two 30s members is selected", async () => {
    for (const key of ["r1", "r2"]) {
      const page = await openAs(key);
      const card = page.getByTestId("card-sampling");
      await expect(card).toBeVisible({ timeout: 30000 });
      if ((await page.getByTestId("sampling-state-selected").count()) > 0) {
        selectedKey = key;
      } else {
        await expect(page.getByTestId("sampling-state-not-selected")).toBeVisible();
        notSelectedKey = key;
      }
    }
    expect(selectedKey).toBeTruthy();
    expect(notSelectedKey).toBeTruthy();
  });

  test("C4: selected members enter", async () => {
    for (const key of [selectedKey, "r3"]) {
      const page = await openAs(key);
      await clickNoNav(page, { testId: "btn-sampling-enter" });
      await expect(page.getByTestId("sampling-state-entered")).toBeVisible({ timeout: 30000 });
    }
  });

  test("C5: a member who was not selected cannot enter", async () => {
    const page = await openAs(notSelectedKey);
    const res = await page.request.post(`/api/spaces/${space.spaceId}/sampling/enter`);
    expect(res.status()).toBe(400);
    await page.reload({ waitUntil: "load" });
    await page.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; }" });
    await expect(page.getByTestId("sampling-state-not-selected")).toBeVisible({ timeout: 30000 });
  });

  test("C6: recruiting is closed for participants who never answered", async () => {
    const page = await openAs("r4");
    await expect(page.getByTestId("sampling-state-recruit-closed")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("card-prerequisite")).toHaveCount(0);
  });

  test("C7: newcomers cannot join while sampling", async ({ browser }) => {
    users.r5 = await signUpViaApi(browser, "r5");
    const page = await openAs("r5");
    await expect(page.getByTestId("space-index-page")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("btn-participate")).toHaveCount(0);
  });

  test("C8: the dashboard marks the 30s group filled", async ({ page }) => {
    await goto(page, `${space.spaceUrl}/apps/sampling`);
    await clickNoNav(page, { testId: "sampling-dashboard-refresh" });
    await expect(page.getByTestId("sampling-dash-1-entered")).toHaveText("1");
    await expect(page.getByTestId("sampling-badge-filled-1")).toBeVisible();
    await expect(page.getByTestId("sampling-dash-0-entered")).toHaveText("1");
    await expect(page.getByTestId("sampling-badge-shortage-0")).toBeVisible();
  });

  test("C9: with late joining on, an unselected member participates after Start", async ({ page }) => {
    await transitionSpace(page, space.spaceUrl, "start");
    const member = await openAs(notSelectedKey);
    await expect(member.getByTestId("quest-label")).toBeVisible({ timeout: 30000 });
  });

  test("C10: newcomers can join again once the space is ongoing", async () => {
    const page = await openAs("r5");
    await expect(page.getByTestId("btn-participate")).toBeVisible({ timeout: 30000 });
    const join = await page.request.post(`/api/spaces/${space.spaceId}/participate`, {
      data: { body: { informed_agreed: true } },
    });
    expect(join.ok(), await join.text()).toBeTruthy();
    await page.reload({ waitUntil: "load" });
    await page.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; }" });
    await expect(page.getByTestId("card-prerequisite")).toBeVisible({ timeout: 30000 });
  });
});
