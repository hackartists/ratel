import { expect, test } from "@playwright/test";
import {
  addPollQuestion,
  click,
  clickNoNav,
  commitAutosave,
  createAction,
  createTeamFromHome,
  createTeamPostFromHome,
  fill,
  fillPollQuestion,
  getEditor,
  goto,
  publishSpacePublic,
  transitionSpace,
} from "../utils";

// ─────────────────────────────────────────────────────────────────────────────
// Space admins run any action right away: a discussion and a poll that both
// depend on an incomplete Follow action and are still Designing stay open to
// the admin after the space has started (Ongoing), where the arena otherwise
// shows the admin the participant view.
// ─────────────────────────────────────────────────────────────────────────────
test.describe.serial("Space admin action bypass", () => {
  test.setTimeout(240_000);

  let spaceId;
  let spaceUrl;
  let followId;
  let discussionId;
  let pollId;

  const stamp = Date.now();
  const teamUsername = `e2e_ab_${stamp}`;
  const postTitle = `Admin bypass space ${stamp}`;
  const postContents =
    "Space for checking that space admins can join actions whose dependencies " +
    "are not met and which have not started yet.";
  const discussionTitle = `Admin bypass discussion ${stamp}`;
  const pollTitle = `Admin bypass poll ${stamp}`;
  const commentText = `Admin comment before start ${stamp}`;

  async function listActions(page) {
    const res = await page.request.get(`/api/spaces/${spaceId}/actions`);
    expect(res.ok(), `list actions: ${await res.text()}`).toBeTruthy();
    return res.json();
  }

  async function setDependsOn(page, actionId, dependsOn) {
    const res = await page.request.post(`/api/spaces/${spaceId}/actions/${actionId}`, {
      data: { req: { depends_on: dependsOn } },
    });
    expect(res.ok(), `set depends_on: ${await res.text()}`).toBeTruthy();
  }

  test("Setup: create team + post + space", async ({ page }) => {
    await createTeamFromHome(page, {
      username: teamUsername,
      nickname: "Admin Bypass Team",
      description: "Admin action bypass e2e test",
    });
    const postId = await createTeamPostFromHome(page, teamUsername, postTitle, postContents);
    const spaceRes = await page.request.post("/api/spaces/create", {
      data: { req: { post_id: postId } },
    });
    expect(spaceRes.ok(), `create space: ${await spaceRes.text()}`).toBeTruthy();
    spaceId = (await spaceRes.json()).space_id;
    spaceUrl = `/spaces/${spaceId}`;
  });

  test("Setup: Follow action the admin never completes", async ({ page }) => {
    await createAction(page, spaceUrl, "follow", /\/actions\/follows\//);
    const m = page.url().match(/\/actions\/follows\/([^/?#]+)/);
    expect(m, "follow id should be parseable from editor URL").not.toBeNull();
    followId = m[1];
  });

  test("Setup: discussion depending on the Follow action", async ({ page }) => {
    await createAction(page, spaceUrl, "discuss", /\/actions\/discussions\/[^/]+\/edit/);
    const m = page.url().match(/\/actions\/discussions\/([^/]+)\/edit/);
    expect(m, "discussion id should be parseable from editor URL").not.toBeNull();
    discussionId = m[1];

    await fill(page, { placeholder: "Enter discussion title..." }, discussionTitle);
    const editor = await getEditor(page);
    await editor.fill("Admins may comment before this discussion starts.");
    await commitAutosave(page);

    await setDependsOn(page, discussionId, [followId]);
  });

  test("Setup: poll depending on the Follow action", async ({ page }) => {
    await createAction(page, spaceUrl, "poll", /\/actions\/polls\//);
    const m = page.url().match(/\/actions\/polls\/([^/?#]+)/);
    expect(m, "poll id should be parseable from editor URL").not.toBeNull();
    pollId = m[1];

    await fill(page, { placeholder: "Enter poll title..." }, pollTitle);
    await commitAutosave(page);
    await addPollQuestion(page, "single");
    await fillPollQuestion(page, 0, { title: "Ready?", options: ["Yes", "No"] });

    await setDependsOn(page, pollId, [followId]);
  });

  test("Setup: publish and start the space", async ({ page }) => {
    await publishSpacePublic(page, spaceUrl);
    await transitionSpace(page, spaceUrl, "start");
  });

  test("Admin: gated, not-started actions are reported unlocked", async ({ page }) => {
    const actions = await listActions(page);
    for (const id of [discussionId, pollId]) {
      const action = actions.find((a) => a.action_id === id);
      expect(action, `action ${id} listed for admin`).toBeTruthy();
      expect(action.status).toBe("Designing");
      expect(action.depends_on).toEqual([followId]);
      expect(action.dependencies_met).toBe(true);
    }

    await goto(page, spaceUrl);
    await expect(page.getByTestId(`quest-card-${discussionId}`)).toHaveAttribute("data-locked", "false");
    await expect(page.getByTestId(`quest-card-${pollId}`)).toHaveAttribute("data-locked", "false");
  });

  test("Admin: comments on the gated, not-started discussion", async ({ page }) => {
    await goto(page, `${spaceUrl}/discussions/${discussionId}`);
    await expect(page.getByTestId("discussion-arena-overlay")).toBeVisible({ timeout: 20000 });

    const textarea = page.locator(".comment-input__textarea");
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await textarea.fill(commentText);
    await page.locator(".comment-input__submit").click();

    await expect(page.locator(".comment-item", { hasText: commentText })).toBeVisible({ timeout: 15000 });
  });

  test("Admin: answers the gated, not-started poll", async ({ page }) => {
    await goto(page, spaceUrl);
    const card = page.getByTestId(`quest-card-${pollId}`);
    await card.scrollIntoViewIfNeeded();
    await click(page, { testId: `quest-card-${pollId}` });

    const overlay = page.getByTestId("poll-arena-overlay");
    await expect(overlay).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("poll-arena-begin")).toBeEnabled();
    await clickNoNav(page, { testId: "poll-arena-begin" });

    await expect(overlay.locator(".option-single").first()).toBeVisible({ timeout: 30000 });
    await overlay.locator(".option-single").first().click();
    await clickNoNav(page, { testId: "poll-submit" });
    await clickNoNav(page, { testId: "poll-confirm-submit" });
    await expect(overlay).toBeHidden({ timeout: 30000 });

    const poll = (await listActions(page)).find((a) => a.action_id === pollId);
    expect(poll.user_participated).toBe(true);
  });
});
