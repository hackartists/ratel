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
} from "../utils";

/**
 * Sampling app — settings, cell target preview, start gating and the
 * Open → Sampling → Ongoing status buttons.
 *
 * Creator: hi+user1@biyard.co (user.json). Requires a `bypass` backend.
 */
test.describe.serial("Sampling app settings and status flow", () => {
  test.describe.configure({ timeout: 180000 });

  const stamp = Date.now();
  let space;
  let unconfigured;

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

  test("A6: Open → Sampling swaps the Sampling button for Start", async ({ page }) => {
    await publishSpacePublic(page, space.spaceUrl);
    await transitionSpace(page, space.spaceUrl, "sampling");
    await expect(page.getByTestId("btn-sampling")).toHaveCount(0);
    await expect(page.getByTestId("arena-topbar-status")).toHaveText("Sampling");
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
