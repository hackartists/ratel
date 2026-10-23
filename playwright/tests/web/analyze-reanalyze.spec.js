import { expect, test } from "@playwright/test";
import {
  click,
  createTeamFromHome,
  createTeamPostFromHome,
  goto,
} from "../utils";

/**
 * Analyze report re-analysis: the creator opens a finished report, clicks
 * "Re-analyze" next to "Download Excel", confirms, and the report runs the
 * aggregation pipeline again against the current data before returning to
 * `finish`.
 */
test.describe.serial("Analyze report re-analysis", () => {
  let spaceId;
  let spaceUrl;
  let reportId;

  const teamUsername = `e2e_ra_${Date.now()}`;

  /** Poll the report detail API until its status matches `status`. */
  async function waitForReportStatus(page, status, timeout = 90000) {
    await expect
      .poll(
        async () => {
          const res = await page.request.get(
            `/api/spaces/${spaceId}/apps/analyzes/reports/${reportId}`,
          );
          if (!res.ok()) return `http ${res.status()}`;
          return (await res.json()).report.status;
        },
        { timeout, intervals: [1000, 2000, 3000] },
      )
      .toBe(status);
  }

  test("Setup: create team, post, space and install Analyzes", async ({
    page,
  }) => {
    await createTeamFromHome(page, {
      username: teamUsername,
      nickname: "Reanalyze Team",
      description: "E2E test team for analyze re-analysis",
    });
    const postId = await createTeamPostFromHome(
      page,
      teamUsername,
      "Reanalyze Playwright Space",
      "This space is created by the analyze re-analysis Playwright spec to verify that a saved analyze report can be re-run against the current data.",
    );

    const spaceRes = await page.request.post("/api/spaces/create", {
      data: { req: { post_id: postId } },
    });
    expect(spaceRes.ok(), `create space: ${await spaceRes.text()}`).toBeTruthy();
    spaceId = (await spaceRes.json()).space_id;
    spaceUrl = `/spaces/${spaceId}`;

    await goto(page, spaceUrl);
    await click(page, { testId: "btn-settings" });
    await expect(page.getByTestId("apps-section")).toBeVisible();
    await page.getByTestId("install-app-analyzes").click();
    await expect(page.getByTestId("settings-app-analyzes")).toBeVisible({
      timeout: 15000,
    });
  });

  test("Setup: create an analyze report and wait for the first run", async ({
    page,
  }) => {
    const res = await page.request.post(
      `/api/spaces/${spaceId}/apps/analyzes/reports`,
      { data: { req: { name: "Reanalyze report", filters: [] } } },
    );
    expect(res.ok(), `create report: ${await res.text()}`).toBeTruthy();
    reportId = (await res.json()).report_id;

    await waitForReportStatus(page, "finish");
  });

  test("Re-analyze button sits next to Download Excel and re-runs the report", async ({
    page,
  }) => {
    await goto(page, `${spaceUrl}/apps/analyzes/report/${reportId}`);

    const pollPanel = page.locator('[data-panel="poll"]');
    const reanalyzeBtn = pollPanel.getByTestId("reanalyze-btn");
    await expect(reanalyzeBtn).toBeVisible({ timeout: 30000 });
    await expect(reanalyzeBtn).toBeEnabled();
    await expect(pollPanel.getByTestId("report-export-excel-btn")).toBeVisible();

    await reanalyzeBtn.click();
    await expect(page.getByTestId("reanalyze-confirm-popup")).toBeVisible();

    const reanalyzeResponse = page.waitForResponse(
      (r) =>
        r.url().includes(`/reports/${reportId}/reanalyze`) &&
        r.request().method() === "POST",
    );
    await page.getByTestId("reanalyze-confirm-btn").click();
    const response = await reanalyzeResponse;
    expect(response.status(), await response.text()).toBe(200);
    expect((await response.json()).status).toBe("in_progress");

    await waitForReportStatus(page, "finish");
    await expect(reanalyzeBtn).toHaveAttribute("data-running", "false", {
      timeout: 30000,
    });
    await expect(reanalyzeBtn).toBeEnabled();
  });

  test("Cancelling the confirm dialog does not re-run the report", async ({
    page,
  }) => {
    await goto(page, `${spaceUrl}/apps/analyzes/report/${reportId}`);

    const reanalyzeBtn = page
      .locator('[data-panel="poll"]')
      .getByTestId("reanalyze-btn");
    await expect(reanalyzeBtn).toBeEnabled({ timeout: 30000 });

    let reanalyzeCalled = false;
    page.on("request", (r) => {
      if (r.url().includes("/reanalyze")) reanalyzeCalled = true;
    });

    await reanalyzeBtn.click();
    await expect(page.getByTestId("reanalyze-confirm-popup")).toBeVisible();
    await page.getByTestId("reanalyze-cancel-btn").click();
    await expect(page.getByTestId("reanalyze-confirm-popup")).toBeHidden();
    expect(reanalyzeCalled).toBe(false);
    await expect(reanalyzeBtn).toHaveAttribute("data-running", "false");
  });
});
