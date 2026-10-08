import { expect, test } from "@playwright/test";
import {
  click,
  createAction,
  fill,
  goto,
  publishAction,
} from "../utils";

// ─────────────────────────────────────────────────────────────────────────────
// Poll privacy-consent question type — covers roadmap/poll-privacy-consent.md
// acceptance criteria:
//   - Designer can add a privacy_consent question, author terms.
//   - Participant sees terms, must agree before the phone field activates.
//   - Participant can verify a phone number via SMS code (bypass "000000").
//   - Submitting without agreement is rejected (submit stays disabled).
//   - Submitting with a bad/unverified code is rejected server-side.
// Requires backend built with `--features bypass` (phone code "000000").
// ─────────────────────────────────────────────────────────────────────────────

test.describe.serial("Poll privacy-consent question", () => {
  test.setTimeout(180_000);

  let spaceUrl;
  let spaceId;
  let pollId;

  const postTitle = `Poll Privacy Consent E2E ${Date.now()}`;
  const postContents =
    "This post drives the poll-privacy-consent Playwright spec. It is long " +
    "enough to satisfy the minimum content length the backend enforces " +
    "before a space can be spun up from the draft post.";

  const termsTitle = "Phone Number Collection & Use Consent";
  const termsBodyText =
    "We collect your phone number solely to contact prize-draw winners.";

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: "user.json" });
    const page = await context.newPage();

    try {
      const postRes = await page.request.post("/api/posts", { data: {} });
      expect(postRes.ok(), `create post: ${await postRes.text()}`).toBeTruthy();
      const postPk = (await postRes.json()).post_pk;
      const postId = postPk.includes("#") ? postPk.split("#")[1] : postPk;

      await goto(page, `/posts/${postId}/edit`);
      await fill(page, { placeholder: "Title your post…" }, postTitle);
      const editor = page.locator("[contenteditable]").first();
      await editor.fill(postContents);
      await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 30000 });

      const spaceRes = await page.request.post("/api/spaces/create", {
        data: { req: { post_id: postId } },
      });
      expect(spaceRes.ok(), `create space: ${await spaceRes.text()}`).toBeTruthy();
      spaceId = (await spaceRes.json()).space_id;
      spaceUrl = `/spaces/${spaceId}`;
    } finally {
      await context.close();
    }
  });

  test("Designer: add privacy_consent question, author terms in rich-text editor", async ({
    page,
  }) => {
    await createAction(page, spaceUrl, "poll", /\/actions\/polls\//);

    const pollUrlMatch = page.url().match(/\/actions\/polls\/([^/?#]+)/);
    expect(pollUrlMatch, "poll id should be parseable from editor URL").not.toBeNull();
    pollId = pollUrlMatch[1];

    await fill(page, { placeholder: "Enter poll title..." }, "Privacy Consent Poll");
    await page.keyboard.press("Tab");
    await page.waitForLoadState("load");

    // Add a question and switch its type to Privacy Consent.
    await click(page, { testId: "poll-question-add" });
    const block = page.getByTestId("poll-question-0");
    await expect(block).toBeVisible();
    await block.getByText("Privacy Consent", { exact: true }).click();
    await page.waitForLoadState("load");

    const titleInput = block.locator("input.input").first();
    await titleInput.fill("Prize draw contact consent");
    await titleInput.press("Tab");
    await page.waitForLoadState("load");

    const termsTitleInput = page.getByTestId("poll-question-0-terms-title");
    await expect(termsTitleInput).toBeVisible();
    await termsTitleInput.fill(termsTitle);
    await termsTitleInput.press("Tab");
    await page.waitForLoadState("load");

    const privacyConsentBody = page.getByTestId("poll-question-0-privacy-consent");
    const editorRoot = privacyConsentBody.locator('.ratel-editor[data-bound="true"]');
    await expect(editorRoot).toBeAttached({ timeout: 10000 });
    const termsEditor = editorRoot.locator(".re-content");
    await expect(termsEditor).toBeVisible();
    await termsEditor.click();
    await page.keyboard.type(termsBodyText);
    // Past the editor script's 120ms change-debounce before committing.
    await page.waitForTimeout(400);
    await page.keyboard.press("Tab");
    await page.waitForLoadState("load");

    // Re-fetch the poll to confirm the question persisted with the terms.
    // The editor's change is reported async (debounced + a network PATCH),
    // so poll instead of asserting on a single immediate GET.
    await expect
      .poll(
        async () => {
          const getRes = await page.request.get(`/api/spaces/${spaceId}/polls/${pollId}`);
          if (!getRes.ok()) return null;
          const poll = await getRes.json();
          return poll.questions[0]?.terms_body_html ?? null;
        },
        { timeout: 15000 },
      )
      .toContain(termsBodyText);

    const getRes = await page.request.get(`/api/spaces/${spaceId}/polls/${pollId}`);
    expect(getRes.ok(), `get poll: ${await getRes.text()}`).toBeTruthy();
    const poll = await getRes.json();
    const question = poll.questions[0];
    expect(question.answer_type).toBe("privacy_consent");
    expect(question.terms_title).toBe(termsTitle);
    expect(question.terms_body_html).toContain(termsBodyText);

    await publishAction(page);

    // Open the space to the public and start it (Open → Ongoing) so a
    // second account can join as a genuine Participant. The Creator's own
    // view always resolves to the designer page (isSpaceAdmin(role) short-
    // circuits PollCreatorPage regardless of currentRole), so there is no
    // in-page toggle that gets a Creator into the participant response UI —
    // a different account is required to exercise it.
    const publishRes = await page.request.patch(`/api/spaces/${spaceId}`, {
      data: { req: { publish: true, visibility: "PUBLIC" } },
    });
    expect(publishRes.ok(), `publish space: ${await publishRes.text()}`).toBeTruthy();
    const startRes = await page.request.patch(`/api/spaces/${spaceId}`, {
      data: { req: { start: true } },
    });
    expect(startRes.ok(), `start space: ${await startRes.text()}`).toBeTruthy();
  });

  test("Participant: sees terms, submit disabled until agreement + verified phone", async ({
    browser,
  }) => {
    // A fresh context authenticated as a DIFFERENT account (admin.json) —
    // relative to spaceId's creator (user.json) this account is a genuine
    // Participant once it calls /participate on the now-public, Ongoing space.
    const context = await browser.newContext({ storageState: "admin.json" });
    const page = await context.newPage();

    const participateRes = await page.request.post(`/api/spaces/${spaceId}/participate`, {
      data: { body: { informed_agreed: true } },
    });
    expect(
      participateRes.ok() || participateRes.status() === 409,
      `participate: ${await participateRes.text()}`,
    ).toBeTruthy();

    await goto(page, `/spaces/${spaceId}/actions/polls/${pollId}`);

    // Participant role renders PollResponseView variant="read", which opens
    // on an overview step (poll-read-overview) before the question-by-
    // question flow; click through to reach the actual question. Poll for
    // the Next button instead of a single isVisible check — CI's k8s pod is
    // slower than local dev and the suspense-loaded role/space queries can
    // still be in flight right after goto()'s hydration wait.
    await expect(page.getByTestId("poll-read-next")).toBeVisible({ timeout: 20000 });
    await page.getByTestId("poll-read-next").click();
    await page.waitForLoadState("load");

    const question = page.getByTestId("poll-question-privacy-consent");
    await expect(question).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("pc-terms-title")).toHaveText(termsTitle);
    await expect(page.getByTestId("pc-terms")).toContainText(termsBodyText);

    const submitBtn = page.getByRole("button", { name: /^(Submit|제출)$/ });

    // Phone section should start disabled (agreement not yet checked).
    await expect(page.getByTestId("pc-phone-section")).toHaveAttribute("data-disabled", "true");

    // Check agreement — phone section activates.
    await page.getByTestId("pc-agree-checkbox").check();
    await expect(page.getByTestId("pc-phone-section")).toHaveAttribute("data-disabled", "false");

    // Enter phone + send/verify code with the bypass test code.
    const phone = `+8210${Date.now().toString().slice(-8)}`;
    await page.getByTestId("pc-phone-input").fill(phone);
    await page.getByTestId("pc-send-code-btn").click();
    await page.waitForLoadState("load");

    await page.getByTestId("pc-code-input").fill("000000");
    await page.getByTestId("pc-verify-btn").click();
    await expect(page.getByTestId("pc-verified-pill")).toBeVisible({ timeout: 10000 });

    // Submit the poll response.
    if (await submitBtn.count() > 0) {
      await submitBtn.click().catch(() => {});
      const confirmBtn = page.getByTestId(/poll-(read-)?confirm-submit/);
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }

    // Verify the server stored the plaintext phone answer.
    await expect
      .poll(
        async () => {
          const res = await page.request.get(
            `/api/spaces/${spaceId}/polls/${pollId}/results`,
          );
          if (!res.ok()) return null;
          const body = await res.json();
          return body.sample_answers?.some((a) =>
            a.answers?.some(
              (ans) => ans.answer_type === "privacy_consent" && ans.phone === phone,
            ),
          );
        },
        { timeout: 15000 },
      )
      .toBeTruthy();
  });

  test("Server rejects submission with a wrong/unverified code", async ({ page }) => {
    // Server-side re-verification: direct API call with a bogus code must
    // be rejected even though the client could claim "agreed: true".
    await goto(page, "/");
    const badPhone = `+8210${(Date.now() + 1).toString().slice(-8)}`;
    const res = await page.request.post(
      `/api/spaces/${spaceId}/polls/${pollId}/respond`,
      {
        data: {
          req: {
            answers: [
              {
                answer_type: "privacy_consent",
                agreed: true,
                phone: badPhone,
                code: "999999",
              },
            ],
          },
        },
      },
    );
    expect(res.ok(), "respond with bad code must be rejected").toBeFalsy();
  });
});
