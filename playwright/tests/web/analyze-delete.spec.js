import { expect, test } from "@playwright/test";
import {
  clickNoNav,
  createTeamFromHome,
  createTeamPostFromHome,
  goto,
  waitForAppReady,
} from "../utils";

/**
 * Analyze report deletion: the creator deletes a saved report from the list
 * carousel and from the report detail page. Each path goes through a danger
 * confirm popup; cancelling sends no request, confirming removes the report
 * (and its results) so the API answers 404 afterwards.
 */
test.describe.serial("Analyze report deletion", () => {
  let spaceId;
  let spaceUrl;
  let listReportId;
  let detailReportId;

  const teamUsername = `e2e_ad_${Date.now()}`;

  /** Poll the report detail API until its status matches `status`. */
  async function waitForReportStatus(page, reportId, status, timeout = 90000) {
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

  /** Create a report through the API and return its id. */
  async function createReport(page, name) {
    const res = await page.request.post(
      `/api/spaces/${spaceId}/apps/analyzes/reports`,
      { data: { req: { name, filters: [] } } },
    );
    expect(res.ok(), `create report: ${await res.text()}`).toBeTruthy();
    return (await res.json()).report_id;
  }

  /** Wait for the DELETE request of `reportId` and return its response. */
  function waitForDelete(page, reportId) {
    return page.waitForResponse(
      (r) =>
        r.url().includes(`/apps/analyzes/reports/${reportId}`) &&
        r.request().method() === "DELETE",
    );
  }

  test("Setup: create team, post, space and install Analyzes", async ({
    page,
  }) => {
    await createTeamFromHome(page, {
      username: teamUsername,
      nickname: "Analyze Delete Team",
      description: "E2E test team for analyze report deletion",
    });
    const postId = await createTeamPostFromHome(
      page,
      teamUsername,
      "Analyze Delete Playwright Space",
      "This space is created by the analyze report deletion Playwright spec to verify that a saved analyze report can be deleted from the list and the detail page.",
    );

    const spaceRes = await page.request.post("/api/spaces/create", {
      data: { req: { post_id: postId } },
    });
    expect(spaceRes.ok(), `create space: ${await spaceRes.text()}`).toBeTruthy();
    spaceId = (await spaceRes.json()).space_id;
    spaceUrl = `/spaces/${spaceId}`;

    await goto(page, spaceUrl);
    await clickNoNav(page, { testId: "btn-settings" });
    await expect(page.getByTestId("apps-section")).toBeVisible();
    await clickNoNav(page, { testId: "install-app-analyzes" });
    await expect(page.getByTestId("settings-app-analyzes")).toBeVisible({
      timeout: 15000,
    });
  });

  test("Setup: create two analyze reports and wait for them to finish", async ({
    page,
  }) => {
    detailReportId = await createReport(page, "Delete from detail");
    await waitForReportStatus(page, detailReportId, "finish");
    listReportId = await createReport(page, "Delete from list");
    await waitForReportStatus(page, listReportId, "finish");
  });

  test("Cancelling the delete popup on the list keeps the report", async ({
    page,
  }) => {
    await goto(page, `${spaceUrl}/apps/analyzes`);
    await expect(page.getByTestId(`report-card-${listReportId}`)).toBeVisible({
      timeout: 30000,
    });

    let deleteCalled = false;
    page.on("request", (r) => {
      if (r.method() === "DELETE" && r.url().includes("/apps/analyzes/reports/"))
        deleteCalled = true;
    });

    await clickNoNav(page, { testId: `report-delete-${listReportId}` });
    await expect(page.getByTestId("delete-report-popup")).toBeVisible();
    await clickNoNav(page, { testId: "delete-report-popup-cancel" });
    await expect(page.getByTestId("delete-report-popup")).toBeHidden();

    expect(deleteCalled).toBe(false);
    await expect(page.getByTestId(`report-card-${listReportId}`)).toBeVisible();
  });

  test("Deleting from the list removes the card and the report", async ({
    page,
  }) => {
    await goto(page, `${spaceUrl}/apps/analyzes`);
    await expect(page.getByTestId("report-count")).toContainText("2");

    await clickNoNav(page, { testId: `report-delete-${listReportId}` });
    await expect(page.getByTestId("delete-report-popup")).toBeVisible();
    const deleted = waitForDelete(page, listReportId);
    await clickNoNav(page, { testId: "delete-report-popup-confirm" });
    const response = await deleted;
    expect(response.status(), await response.text()).toBe(200);

    await expect(page.getByTestId("delete-report-popup")).toBeHidden();
    await expect(page.getByTestId(`report-card-${listReportId}`)).toHaveCount(0);
    await expect(page.getByTestId(`report-card-${detailReportId}`)).toBeVisible();
    await expect(page.getByTestId("report-count")).toContainText("1");

    const gone = await page.request.get(
      `/api/spaces/${spaceId}/apps/analyzes/reports/${listReportId}`,
    );
    expect(gone.status()).toBe(404);
  });

  test("Deleting from the detail page returns to the updated list", async ({
    page,
  }) => {
    await goto(page, `${spaceUrl}/apps/analyzes/report/${detailReportId}`);
    await expect(page.getByTestId("arena-title")).toHaveText(
      "Delete from detail",
      { timeout: 30000 },
    );

    await clickNoNav(page, { testId: "report-delete-btn" });
    await expect(page.getByTestId("delete-report-popup")).toBeVisible();
    const deleted = waitForDelete(page, detailReportId);
    await clickNoNav(page, { testId: "delete-report-popup-confirm" });
    const response = await deleted;
    expect(response.status(), await response.text()).toBe(200);

    await page.waitForURL(new RegExp(`/spaces/${spaceId}/apps/analyzes$`));
    await waitForAppReady(page);
    await expect(page.getByTestId(`report-card-${detailReportId}`)).toHaveCount(0);
    await expect(page.getByTestId("report-count")).toContainText("0");
    await expect(page.getByTestId("report-card-new")).toBeVisible();

    const gone = await page.request.get(
      `/api/spaces/${spaceId}/apps/analyzes/reports/${detailReportId}`,
    );
    expect(gone.status()).toBe(404);
  });
});
