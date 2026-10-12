import { test, expect } from "@playwright/test";
import {
  click,
  clickNoNav,
  createAction,
  createTeamFromHome,
  createTeamPostFromHome,
  fill,
  goto,
  getLocator,
  getEditor,
  waitPopup,
  addPollQuestion,
  addRequiredAttribute,
  fillPollQuestion,
  togglePrerequisite,
  commitAutosave,
} from "../utils";

/**
 * Space Governance Scenario — Full E2E
 *
 * Users:
 *   - Creator1    : hi+user1@biyard.co  — pre-authenticated (user.json)
 *   - Participant1: hi+user2@biyard.co  — existing account, invited as team Member
 *                                         (non-admin → space viewer role)
 *   - Viewer      : fresh sign-up via space page
 *                   → clicks Participate but does NOT complete prerequisite poll
 *   - Participant2 : fresh sign-up via space page → completes prerequisite poll
 *   - Participant3 : fresh sign-up via space page → completes prerequisite poll
 *
 * Test execution order:
 *   1.  Creator1: Create team
 *   2.  Creator1: Invite Participant1 as Member (non-admin → viewer role in space)
 *   3.  Creator1: Create post + space
 *   4.  Creator1: Add Follow Team action
 *   5.  Creator1: Add Quiz with 3 study attachments + 2x boost
 *   6.  Creator1: Add preliminary Poll (사전조사, prerequisite)
 *   7.  Creator1: Add final Poll (최종조사, 10x boost)
 *   8.  Creator1: Add Discussion (not published, 5x boost)
 *   9.  Creator1: General settings — anonymous ON
 *   10. Creator1: Panel settings — age + gender, collective
 *   11. Creator1: Publish space as public
 *   12. Viewer:       Sign up from space + Participate (no prereq completion)
 *   13. Participant2: Sign up from space + complete prerequisite poll
 *   14. Participant3: Sign up from space + complete prerequisite poll
 *
 * NOTE: Requires backend built with `--features bypass` so that email
 *       verification accepts the hardcoded code "000000".
 */

// ─── User definitions ───────────────────────────────────────────────────────

const participant1 = {
  email: "hi+user2@biyard.co",
  password: "admin!234",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Signs up a new user via the published space page's "Sign In" button.
 * Returns { context, page } — caller is responsible for context.close().
 */
async function signUpFromSpace(
  browser,
  { email, username, name, password },
  spaceUrl
) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  await goto(page, spaceUrl);
  // Pause card-float animation so Playwright clicks don't miss
  await page.addStyleTag({
    content: "*, *::before, *::after { animation-play-state: paused !important; }",
  });
  await clickNoNav(page, { testId: "btn-signin" });
  await waitPopup(page, { visible: true });

  // Passwordless email-code flow: enter email → Continue (sends code) →
  // enter code "000000" → Continue (verifies). For a brand-new account the
  // login flow surfaces UserNotFound and opens the signup modal with the
  // email + code already verified, so only profile fields remain.
  await fill(page, { placeholder: "Enter your email address" }, email);
  await click(page, { testId: "continue-button" });
  await fill(page, { testId: "code-input" }, "000000");
  await click(page, { testId: "continue-button" });

  // Signup modal opens (code valid, account not found). Fill profile + ToS.
  await fill(page, { placeholder: "Enter your display name" }, name);
  await fill(page, { placeholder: "Enter your user name" }, username);
  await click(page, {
    label: "[Required] I have read and accept the Terms of Service.",
  });
  await click(page, { text: "Finished Sign-up" });
  await waitPopup(page, { visible: false });

  // FR-2 #8 — fresh signups land on /onboarding/connections (cross-posting
  // post-signup interstitial). Skip it so the test can return to the
  // space-driven flow and find btn-participate on ArenaViewer.
  await expect(page).toHaveURL(/\/onboarding\/connections/, { timeout: 10000 });
  await click(page, { testId: "onboarding-skip" });
  await goto(page, spaceUrl);

  return { context, page };
}

/**
 * Signs up from the space page then clicks Participate but does NOT complete
 * the prerequisite poll — simulates a viewer who is registered but inactive.
 */
async function signUpAndSkipPrereq(browser, user, spaceUrl) {
  const { context, page } = await signUpFromSpace(browser, user, spaceUrl);

  try {
    // Verify credential (bypass mode — just click the button)
    await page.getByTestId("btn-verify").click({ force: true });
    await page.waitForLoadState();

    await page.addStyleTag({
      content: "*, *::before, *::after { animation-play-state: paused !important; }",
    });
    await clickNoNav(page, { testId: "btn-participate" });

    // ConsentModal appears — check the consent checkbox and confirm
    await expect(page.getByTestId("card-consent")).toBeVisible();
    await page.locator('input[type="checkbox"]').check();
    await click(page, { testId: "btn-consent-confirm" });

    // Wait for consent modal to disappear (server call + role transition)
    await expect(page.getByTestId("card-consent")).toBeHidden({
      timeout: 15000,
    });

    // PrerequisiteCard appears — user sees the checklist but doesn't complete anything
    await expect(page.getByTestId("card-prerequisite")).toBeVisible({
      timeout: 30000,
    });
  } finally {
    await context.close();
  }
}

/**
 * Signs up from the space page then completes the prerequisite poll.
 */
async function signUpAndParticipate(browser, user, spaceUrl) {
  const { context, page } = await signUpFromSpace(browser, user, spaceUrl);

  try {
    // Verify credential (bypass mode — just click the button)
    await page.getByTestId("btn-verify").click({ force: true });
    await page.waitForLoadState();

    await page.addStyleTag({
      content: "*, *::before, *::after { animation-play-state: paused !important; }",
    });
    await clickNoNav(page, { testId: "btn-participate" });

    // ConsentModal appears — check the consent checkbox and confirm
    await expect(page.getByTestId("card-consent")).toBeVisible();
    await page.locator('input[type="checkbox"]').check();
    await click(page, { testId: "btn-consent-confirm" });

    // Wait for consent modal to disappear (server call + role transition)
    await expect(page.getByTestId("card-consent")).toBeHidden({
      timeout: 15000,
    });

    // PrerequisiteCard appears with the checklist
    await expect(page.getByTestId("card-prerequisite")).toBeVisible({
      timeout: 30000,
    });

    // Click the prerequisite poll item — opens the full-screen poll overlay
    const prereqItem = page.getByTestId("card-prerequisite").locator(".prereq-item").first();
    await prereqItem.click();

    // Poll overlay appears with an Overview screen first
    const overlay = page.getByTestId("poll-arena-overlay");
    await expect(overlay).toBeVisible();

    // Click "Begin Poll" to enter the question view
    await clickNoNav(page, { testId: "poll-arena-begin" });

    // Wait for poll options to load
    await expect(overlay.locator(".option-single").first()).toBeVisible({
      timeout: 30000,
    });

    // Select the first poll option inside the overlay
    await overlay.locator(".option-single").first().click();

    // Submit the poll using testId (avoids ambiguity with confirm dialog's Submit text)
    await clickNoNav(page, { testId: "poll-submit" });

    // Confirm dialog appears — click confirm. Poll submit now closes the
    // overlay in place (no navigation), so we must not wait for a load event.
    await clickNoNav(page, { testId: "poll-confirm-submit" });

    // Wait for overlay to close (server call completes + overlay signal cleared)
    await expect(page.getByTestId("poll-arena-overlay")).toBeHidden({
      timeout: 30000,
    });

    // After completing all prerequisites, user should see the WaitingCard
    await expect(page.getByTestId("card-waiting")).toBeVisible({
      timeout: 30000,
    });
  } finally {
    await context.close();
  }
}

async function openSpaceAppSettings(page, spaceUrl, appType) {
  // Real UI flow: apps are listed inside the topbar Settings panel rather
  // than a standalone /apps page. The legacy `configure-app-{type}` testid
  // was renamed to `settings-app-{type}` (see
  // `settings_panel/apps_section/component.rs`).
  await goto(page, spaceUrl);

  await clickNoNav(page, { testId: "btn-settings" });
  await page.waitForSelector(
    '[data-testid="settings-panel"][data-open="true"]',
    { timeout: 10000 },
  );

  const installButton = page.getByTestId(`install-app-${appType}`);
  if (await installButton.isVisible().catch(() => false)) {
    await installButton.click();
    // Install is a server round-trip + context refresh before the card
    // swaps from install → settings; 5s default is too tight under CI load.
    await expect(page.getByTestId(`settings-app-${appType}`)).toBeVisible({
      timeout: 15000,
    });
  }

  await click(page, { testId: `settings-app-${appType}` });
}

// ─── Test suite ─────────────────────────────────────────────────────────────

test.describe.serial("Space governance scenario", () => {
  let spaceUrl;

  const uniqueId = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const teamNickname = `E2E Gov Team ${uniqueId}`;
  const teamUsername = `e2e_gov_${uniqueId}`;

  const freshPassword = "Test!234";

  const viewer = {
    email: `e2e_vw_${uniqueId}@biyard.co`,
    username: `vw${uniqueId}`,
    name: `Viewer ${uniqueId}`,
    password: freshPassword,
  };

  const participant2 = {
    email: `e2e_p2_${uniqueId}@biyard.co`,
    username: `p2${uniqueId}`,
    name: `Participant Two ${uniqueId}`,
    password: freshPassword,
  };

  const participant3 = {
    email: `e2e_p3_${uniqueId}@biyard.co`,
    username: `p3${uniqueId}`,
    name: `Participant Three ${uniqueId}`,
    password: freshPassword,
  };

  const postTitle = "Governance Research Space";
  const postContents =
    "This space is created for structured governance research. It contains follow, quiz, poll, " +
    "and discussion actions to facilitate organized participation and data collection. " +
    "Participants complete prerequisite actions before accessing the main governance discussion.";

  // ─── 1. Create team ───────────────────────────────────────────────────────

  test("Create a team and post with space, then verify dashboard", async ({
    page,
  }) => {
    // Drive the full setup through the production UI:
    //   home (`/`) → Teams HUD → "Create Team" → ArenaTeamCreationPopup → submit
    // then home → Teams HUD → pick team → team home → "Create Post".
    await createTeamFromHome(page, {
      username: teamUsername,
      nickname: teamNickname,
      description: "E2E test team for space actions",
    });

    const postId = await createTeamPostFromHome(
      page,
      teamUsername,
      postTitle,
      postContents,
    );

    // Space creation stays REST — the post-edit "Go to Space" affordance was
    // removed, and this suite focuses on governance rather than space-creation.
    const spaceRes = await page.request.post("/api/spaces/create", {
      data: { req: { post_id: postId } },
    });
    expect(spaceRes.ok(), `create space: ${await spaceRes.text()}`).toBeTruthy();
    const spaceId = (await spaceRes.json()).space_id;

    spaceUrl = `/spaces/${spaceId}`;

    // Trailing slash required for `/dashboard/:..rest` catch-all; assert via
    // URL match because the dashboard heading is localized.
    await goto(page, `${spaceUrl}/dashboard/`);
    await page.waitForURL(/\/spaces\/[a-z0-9-]+\/dashboard\/?$/, {
      waitUntil: "load",
      timeout: 10000,
    });
  });

  // TODO: add team member into team

  // ─── 3. Create post + space ───────────────────────────────────────────────
  // Started from team home while WASM is hydrated to avoid SSR-only onclick issue.

  // test("Creator1: Create post with space", async ({ page }) => {
  //   await goto(page, `/${teamUsername}/home`);

  //   await click(page, { text: "Create" });
  //   await page.waitForURL(/\/posts\/.*\/edit/, { waitUntil: "load" });

  //   await fill(page, { placeholder: "Title" }, postTitle);
  //   await click(page, { testId: "skip-space-checkbox" });

  //   const editor = await getEditor(page);
  //   await editor.fill(postContents);

  //   await click(page, { text: "Go to Space" });

  //   await page.waitForURL(/\/spaces\/[a-z0-9-]+\/dashboard/, {
  //     waitUntil: "load",
  //   });
  //   await getLocator(page, { text: "Dashboard" });

  //   const url = new URL(page.url());
  //   spaceUrl = url.pathname.replace(/\/dashboard$/, "");
  // });

  // ─── 4. Follow Team action ────────────────────────────────────────────────

  test("Creator1: Add Follow Team action", async ({ page }) => {
    await createAction(page, spaceUrl, "follow", /\/actions\/follows\//);
  });

  // ─── 5. Quiz + 3 study attachments + 2x boost ────────────────────────────

  test("Creator1: Add Quiz with study materials and 2x boost", async ({
    page,
  }) => {
    await createAction(page, spaceUrl, "quiz", /\/actions\/quizzes\//);

    // Arena-style quiz creator page: no tabs — ContentCard + QuestionsCard +
    // ConfigCard are all inline on the same page with per-field autosave.

    await fill(
      page,
      { placeholder: "Enter quiz title..." },
      "Study Material Quiz: Governance Basics"
    );

    const editor = await getEditor(page);
    await editor.fill(
      "Read the attached study materials carefully before answering the quiz questions. " +
        "This quiz verifies understanding of the governance framework."
    );

    // Attach study material files via the inline Attachments section
    const dummyPdf = {
      name: "study-material-1.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 dummy content"),
    };
    const fileInputs = page.locator('input[type="file"][accept*=".pdf"]');
    if ((await fileInputs.count()) > 0) {
      const uploader = fileInputs.first();
      await uploader.setInputFiles(dummyPdf);
      await uploader.setInputFiles({
        ...dummyPdf,
        name: "study-material-2.pdf",
      });
      await uploader.setInputFiles({
        ...dummyPdf,
        name: "study-material-3.pdf",
      });
    }

    // INFO: available credits is zero when free membership — reward boost
    // configuration removed with the arena migration of the creator page.

    // QuestionsCard (arena-style): clicking the add button creates a
    // SingleChoice question with two empty option inputs directly. There is
    // no question-type picker modal and no "Add Option" button in the new
    // UI, so we just fill the default options in place.
    await click(page, { testId: "quiz-question-add" });
    await page.waitForLoadState("load");

    const q0 = page.getByTestId("quiz-question-0");
    const q0Inputs = q0.locator("input.input");
    await q0Inputs
      .nth(0)
      .fill("What is the primary goal of decentralized governance?");
    await q0Inputs.nth(1).fill("Centralize all decisions in one authority");
    await q0Inputs.nth(2).fill("Enable transparent collective decision-making");

    // Mark option 2 as the correct answer via the radio dot
    await page.getByTestId("quiz-question-0-opt-1").locator(".q-opt__radio").click();
    await page.waitForLoadState("load");

    await page.keyboard.press("Tab");
    await page.waitForLoadState("load");
  });

  // ─── 6. Poll 1 — 사전조사 (prerequisite) ─────────────────────────────────

  test("Creator1: Add preliminary Poll (사전조사, prerequisite)", async ({
    page,
  }) => {
    await createAction(page, spaceUrl, "poll", /\/actions\/polls\//);

    await fill(
      page,
      { placeholder: "Enter poll title..." },
      "Opinion Survey: Pre-study"
    );
    await commitAutosave(page);

    // Arena poll editor: two option inputs, no Add Option button.
    await addPollQuestion(page, "single");
    await fillPollQuestion(page, 0, {
      title: "How familiar are you with decentralized governance?",
      options: ["Very familiar", "Not familiar at all"],
    });

    // Mark as prerequisite via the ConfigCard tile (no more Settings tab).
    await togglePrerequisite(page);
  });

  // ─── 7. Poll 2 — 최종조사 (10x boost) ────────────────────────────────────

  test("Creator1: Add final Poll (최종조사, 10x boost)", async ({ page }) => {
    await createAction(page, spaceUrl, "poll", /\/actions\/polls\//);

    await fill(
      page,
      { placeholder: "Enter poll title..." },
      "Opinion Survey: Post-study"
    );
    await commitAutosave(page);

    await addPollQuestion(page, "single");
    await fillPollQuestion(page, 0, {
      title:
        "After studying the materials, how would you rate your understanding?",
      options: ["Significantly improved", "No change"],
    });

    // Reward + boost setup: free-tier credits would be 0, so the boost
    // steps from the legacy Settings tab are intentionally skipped here.
    // setReward(page, 10) can be invoked once the user has paid credits.
  });

  // ─── 8. Discussion — saved but not published, 5x boost ───────────────────

  test("Creator1: Add Discussion (not published, 5x boost)", async ({
    page,
  }) => {
    await createAction(
      page,
      spaceUrl,
      "discuss",
      /\/actions\/discussions\/[^/]+\/edit/,
    );

    await fill(
      page,
      { placeholder: "Enter discussion title..." },
      "Governance Framework Discussion"
    );
    // Arena discussion editor has no category field and no Save button —
    // fields autosave on blur.

    const editor = await getEditor(page);
    await editor.fill(
      "This is the main governance discussion thread. Share your insights after completing " +
        "the study materials and preliminary survey."
    );
    await commitAutosave(page);

    // Reward + boost setup: free-tier credits would be 0, so the boost
    // steps from the legacy Settings tab are intentionally skipped here.
    // setReward(page, 5) can be invoked once the user has paid credits.
  });

  // ─── 9. General settings — anonymous ON ───────────────────────────────────

  test("Creator1: Configure space settings — anonymous ON", async ({
    page,
  }) => {
    await openSpaceAppSettings(page, spaceUrl, "general");
    await page.waitForURL(/\/apps\/general$/, { waitUntil: "load" });

    const anonymousSwitch = page.locator("text=Anonymous").locator("../..");
    await anonymousSwitch.locator("button[role='switch']").click();
    await page.waitForLoadState("load");
  });

  // ─── 10. Panel settings — age + gender, collective ───────────────────────

  test("Creator1: Configure panel — age + gender, collective type", async ({
    page,
  }) => {
    await openSpaceAppSettings(page, spaceUrl, "panels");
    await page.waitForURL(/\/apps\/panels$/, { waitUntil: "load" });

    // Arena rewrite flattened the "Attribute groups" section's DOM —
    // the toggle buttons are now cousins of the label span, not
    // siblings, so the old `.getByText().locator('..').getByRole()`
    // chain no longer resolves. `AttributeToggleCard` exposes stable
    // `attr-{university,age,gender}` testids (attribute_groups.rs);
    // address the toggles directly through those.
    await clickNoNav(page, { testId: "attr-age" });
    await clickNoNav(page, { testId: "attr-gender" });

    // "Collective Panel Attributes" appears only once at least one
    // collective attribute is selected — its visibility is the
    // auto-save confirmation we need to wait on (replaces the
    // `waitForLoadState("networkidle")` anti-pattern).
    await getLocator(page, { text: "Collective Panel Attributes" });
  });

  // ─── 11. Publish space as public ──────────────────────────────────────────

  test("Creator1: Publish space as public", async ({ page }) => {
    // Real UI flow: arena viewer → topbar publish icon (btn-publish)
    // → SpaceVisibilityModal → public-option → Confirm.
    await goto(page, spaceUrl + "/");
    await clickNoNav(page, { testId: "btn-publish" });
    await waitPopup(page, { visible: true });
    await clickNoNav(page, { testId: "public-option" });
    await click(page, { label: "Confirm visibility selection" });
    await waitPopup(page, { visible: false });
  });

  // ─── 12. Viewer: sign up + Participate (no prereq completion) ────────────

  test("Viewer: Sign up from space and Participate without completing prereq", async ({
    browser,
  }) => {
    await signUpAndSkipPrereq(browser, viewer, spaceUrl);
  });

  // ─── 13–14. Participants: sign up + complete prerequisite poll ───────────

  test("Participant2: Sign up from space and complete prerequisite poll", async ({
    browser,
  }) => {
    await signUpAndParticipate(browser, participant2, spaceUrl);
  });

  test("Participant3: Sign up from space and complete prerequisite poll", async ({
    browser,
  }) => {
    await signUpAndParticipate(browser, participant3, spaceUrl);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Discussion Required Attributes — gates participation on a Poll's
// single-choice answer matching an allow-list, independent of (AND with)
// Dependency Actions. `can_execute_space_action` runs for the Creator role
// too, so this whole scenario is driven by the Creator alone — no extra
// signups needed.
// ─────────────────────────────────────────────────────────────────────────────
test.describe.serial("Discussion Required Attributes gate", () => {
  let spaceUrl;
  let spaceId;
  let pollId;
  let discussionId;
  let depActionId;

  const postTitle = "Required Attributes E2E Space";
  const postContents =
    "Space for testing the Required Attributes gate on a discussion action. " +
    "A poll question restricts who may participate in the discussion.";

  test("Setup: create team + post + space", async ({ page }) => {
    const teamUsername = `e2e_ra_${Date.now()}`;
    await createTeamFromHome(page, {
      username: teamUsername,
      nickname: "Required Attributes Team",
      description: "Required Attributes e2e test",
    });
    const postId = await createTeamPostFromHome(
      page,
      teamUsername,
      postTitle,
      postContents,
    );
    const spaceRes = await page.request.post("/api/spaces/create", {
      data: { req: { post_id: postId } },
    });
    expect(spaceRes.ok(), `create space: ${await spaceRes.text()}`).toBeTruthy();
    spaceId = (await spaceRes.json()).space_id;
    spaceUrl = `/spaces/${spaceId}`;
  });

  test("Setup: create a gating Poll with a single-choice question", async ({
    page,
  }) => {
    await createAction(page, spaceUrl, "poll", /\/actions\/polls\//);
    await fill(
      page,
      { placeholder: "Enter poll title..." },
      "Required Attributes: Gating Poll",
    );
    await commitAutosave(page);

    await addPollQuestion(page, "single");
    await fillPollQuestion(page, 0, {
      title: "Which track are you in?",
      options: ["Engineering", "Design"],
    });

    const m = page.url().match(/\/actions\/polls\/([^/?#]+)/);
    expect(m, "poll id should be parseable from editor URL").not.toBeNull();
    pollId = m[1];

    // Allow re-submission so the next tests can walk through a disallowed
    // answer and then an allowed answer on the same poll/user.
    const editableRes = await page.request.post(
      `/api/spaces/${spaceId}/polls/${pollId}`,
      { data: { req: { response_editable: true } } },
    );
    expect(
      editableRes.ok(),
      `set response_editable: ${await editableRes.text()}`,
    ).toBeTruthy();
  });

  test("Setup: create a Dependency action to combine AND with Required Attributes", async ({
    page,
  }) => {
    await createAction(page, spaceUrl, "follow", /\/actions\/follows\//);
    const m = page.url().match(/\/actions\/follows\/([^/?#]+)/);
    expect(m, "follow id should be parseable from editor URL").not.toBeNull();
    depActionId = m[1];
    // A Follow action's status defaults to Designing with no prerequisite —
    // leaving it incomplete is enough to exercise the dependency half of
    // the AND once wired onto the discussion below.
  });

  test("Setup: create the gated Discussion and configure both gates", async ({
    page,
  }) => {
    await createAction(
      page,
      spaceUrl,
      "discuss",
      /\/actions\/discussions\/[^/]+\/edit/,
    );
    const m = page.url().match(/\/actions\/discussions\/([^/]+)\/edit/);
    expect(m, "discussion id should be parseable from editor URL").not.toBeNull();
    discussionId = m[1];

    await fill(
      page,
      { placeholder: "Enter discussion title..." },
      "Required Attributes: Gated Discussion",
    );
    const editor = await getEditor(page);
    await editor.fill("Only Engineering-track respondents may post here.");
    await commitAutosave(page);

    await expect(page.getByTestId("section-required-attributes")).toBeVisible();
    await addRequiredAttribute(page, {
      pollTitle: "Required Attributes: Gating Poll",
      questionTitle: "Which track are you in?",
      allowedValues: ["Engineering"],
    });
    await expect(page.getByTestId("chip-required-attribute-0")).toBeVisible();
  });

  test("Blocked: unanswered poll prevents Discussion participation", async ({
    page,
  }) => {
    const res = await page.request.post(
      `/api/spaces/${spaceId}/discussions/${discussionId}/comments`,
      { data: { req: { content: "should be blocked", images: [] } } },
    );
    expect(res.ok(), "comment must be rejected while poll is unanswered").toBeFalsy();
  });

  test("Blocked: answering the poll with a disallowed option still blocks", async ({
    page,
  }) => {
    const respondRes = await page.request.post(
      `/api/spaces/${spaceId}/polls/${pollId}/respond`,
      { data: { req: { answers: [{ answer_type: "single_choice", answer: 1, other: null }] } } },
    );
    expect(respondRes.ok(), `poll respond: ${await respondRes.text()}`).toBeTruthy();

    const res = await page.request.post(
      `/api/spaces/${spaceId}/discussions/${discussionId}/comments`,
      { data: { req: { content: "should still be blocked", images: [] } } },
    );
    expect(
      res.ok(),
      "comment must be rejected when the poll answer is not in the allow-list",
    ).toBeFalsy();
  });

  test("Unlocked: answering with an allowed option satisfies Required Attributes (no dependency configured yet)", async ({
    page,
  }) => {
    const respondRes = await page.request.post(
      `/api/spaces/${spaceId}/polls/${pollId}/respond`,
      { data: { req: { answers: [{ answer_type: "single_choice", answer: 0, other: null }] } } },
    );
    expect(respondRes.ok(), `poll respond: ${await respondRes.text()}`).toBeTruthy();

    // Required Attributes alone is now satisfied and no Dependency Actions
    // are configured on the discussion yet, so participation succeeds.
    const res = await page.request.post(
      `/api/spaces/${spaceId}/discussions/${discussionId}/comments`,
      { data: { req: { content: "unlocked by required attributes alone", images: [] } } },
    );
    expect(
      res.ok(),
      `comment should succeed once Required Attributes is satisfied: ${await res.text()}`,
    ).toBeTruthy();
  });

  test("AND case: wiring an incomplete Dependency Action back on blocks again even though Required Attributes is satisfied", async ({
    page,
  }) => {
    const updateRes = await page.request.post(
      `/api/spaces/${spaceId}/actions/${discussionId}`,
      { data: { req: { depends_on: [depActionId] } } },
    );
    expect(updateRes.ok(), `set dependency: ${await updateRes.text()}`).toBeTruthy();

    const res = await page.request.post(
      `/api/spaces/${spaceId}/discussions/${discussionId}/comments`,
      { data: { req: { content: "blocked by dependency", images: [] } } },
    );
    expect(
      res.ok(),
      "comment must be blocked while the dependency action is incomplete, even though Required Attributes is satisfied",
    ).toBeFalsy();
  });

  test("Fully unlocked: clearing the Dependency Action restores access (Required Attributes + Dependency Actions both AND-satisfied)", async ({
    page,
  }) => {
    const updateRes = await page.request.post(
      `/api/spaces/${spaceId}/actions/${discussionId}`,
      { data: { req: { depends_on: [] } } },
    );
    expect(updateRes.ok(), `clear dependency: ${await updateRes.text()}`).toBeTruthy();

    const res = await page.request.post(
      `/api/spaces/${spaceId}/discussions/${discussionId}/comments`,
      { data: { req: { content: "now allowed through", images: [] } } },
    );
    expect(
      res.ok(),
      `comment must succeed once both gates are satisfied: ${await res.text()}`,
    ).toBeTruthy();
  });
});

/**
 * Space announcement: one per space, pinned first in the action list, and
 * shown to a user right before the participate request goes out.
 */
test.describe.serial("Space announcement", () => {
  let spaceUrl;
  let spaceId;
  let announcementId;

  const uniqueId = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const announcementTitle = `Read before joining ${uniqueId}`;
  const announcementBody = "Please be respectful. Answers are anonymous.";
  const member = {
    email: `e2e_an_${uniqueId}@biyard.co`,
    username: `an${uniqueId}`,
    name: `Announcement Reader ${uniqueId}`,
    password: "Test!234",
  };

  test("Setup: create team + post + space with a Follow action", async ({ page }) => {
    const teamUsername = `e2e_an_${uniqueId}`;
    await createTeamFromHome(page, {
      username: teamUsername,
      nickname: "Announcement Team",
      description: "Space announcement e2e test",
    });
    const postId = await createTeamPostFromHome(
      page,
      teamUsername,
      "Announcement E2E Space",
      "Space for testing the announcement shown before a user joins the space.",
    );
    const spaceRes = await page.request.post("/api/spaces/create", {
      data: { req: { post_id: postId } },
    });
    expect(spaceRes.ok(), `create space: ${await spaceRes.text()}`).toBeTruthy();
    spaceId = (await spaceRes.json()).space_id;
    spaceUrl = `/spaces/${spaceId}`;

    await createAction(page, spaceUrl, "follow", /\/actions\/follows\//);
  });

  test("Creator: write and publish the announcement", async ({ page }) => {
    await createAction(page, spaceUrl, "announcement", /\/actions\/announcements\//);
    const m = page.url().match(/\/actions\/announcements\/([^/?#]+)/);
    expect(m, "announcement id should be parseable from editor URL").not.toBeNull();
    announcementId = m[1];

    await expect(page.getByTestId("announcement-editor-view")).toBeVisible();
    await fill(page, { testId: "announcement-title-input" }, announcementTitle);
    await commitAutosave(page);
    const editor = await getEditor(page);
    await editor.fill(announcementBody);
    await commitAutosave(page);

    await expect
      .poll(async () => {
        const res = await page.request.get(`/api/spaces/${spaceId}/actions`);
        const actions = await res.json();
        const a = actions.find((x) => x.action_id === announcementId);
        return a ? `${a.title}|${a.description.includes(announcementBody)}` : "";
      })
      .toBe(`${announcementTitle}|true`);

    const statusRes = await page.request.post(
      `/api/spaces/${spaceId}/actions/${announcementId}`,
      { data: { req: { status: "Ongoing" } } },
    );
    expect(statusRes.ok(), `publish announcement: ${await statusRes.text()}`).toBeTruthy();
  });

  test("Creator: a second create returns the same announcement", async ({ page }) => {
    const res = await page.request.post(`/api/spaces/${spaceId}/announcements`);
    expect(res.ok(), `create announcement again: ${await res.text()}`).toBeTruthy();
    expect((await res.json()).action_id).toBe(announcementId);
  });

  test("Creator: the announcement card is pinned first", async ({ page }) => {
    await goto(page, spaceUrl);
    const firstCard = page.locator("#carousel-track .quest-card").first();
    await expect(firstCard).toHaveAttribute("data-testid", "action-card-announcement");
    await expect(firstCard).toContainText(announcementTitle);
  });

  test("Creator: the announcement cannot be a dependency or carry a reward", async ({ page }) => {
    const rewardRes = await page.request.post(
      `/api/spaces/${spaceId}/actions/${announcementId}`,
      { data: { req: { credits: 10 } } },
    );
    expect(rewardRes.status()).toBe(400);
    const prereqRes = await page.request.post(
      `/api/spaces/${spaceId}/actions/${announcementId}`,
      { data: { req: { prerequisite: true } } },
    );
    expect(prereqRes.status()).toBe(400);
  });

  test("Creator: publish space as public", async ({ page }) => {
    await goto(page, spaceUrl + "/");
    await clickNoNav(page, { testId: "btn-publish" });
    await waitPopup(page, { visible: true });
    await clickNoNav(page, { testId: "public-option" });
    await click(page, { label: "Confirm visibility selection" });
    await waitPopup(page, { visible: false });
  });

  test("Member: sees the announcement before joining and can reopen it afterwards", async ({
    browser,
  }) => {
    const { context, page } = await signUpFromSpace(browser, member, spaceUrl);
    try {
      await page.addStyleTag({
        content: "*, *::before, *::after { animation-play-state: paused !important; }",
      });
      await clickNoNav(page, { testId: "btn-participate" });

      const notice = page.getByTestId("card-announcement");
      await expect(notice).toBeVisible();
      await expect(notice.getByTestId("announcement-title")).toHaveText(announcementTitle);
      await expect(notice.getByTestId("announcement-body")).toContainText(announcementBody);

      await clickNoNav(page, { testId: "btn-announcement-continue" });
      await expect(notice).toBeHidden({ timeout: 30000 });

      const entry = page
        .getByTestId("action-card-announcement")
        .or(page.getByTestId("candidate-announcement-link"));
      await expect(entry).toBeVisible({ timeout: 30000 });
      await entry.click();
      await page.waitForURL(/\/actions\/announcements\//, { timeout: 30000 });
      const viewer = page.getByTestId("announcement-viewer-view");
      await expect(viewer).toBeVisible();
      await expect(viewer.getByTestId("announcement-body")).toContainText(announcementBody);
    } finally {
      await context.close();
    }
  });
});
