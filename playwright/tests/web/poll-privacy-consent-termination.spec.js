import { expect, test } from "@playwright/test";
import { createAction, fill, fillQuestionTitle, goto, publishAction, signUpViaApi } from "../utils";

// ─────────────────────────────────────────────────────────────────────────────
// Privacy-consent disagreement ends the survey, and authors can replace the
// termination notice with their own copy.
//
// Poll built by the creator through the editor:
//   Q1 (single)   Are you 19 or older?   Yes / No   — "No" ends the poll with a custom notice
//   Q2 (consent)  Research consent        I agree / I do not agree — disagreeing always ends the poll
//   Q3 (single)   Favorite season?        Spring / Autumn
//
// Participants:
//   A  (Korean UI) Q1 = Yes → Q2: "동의함" reveals the phone verification,
//      "동의하지 않음" opens the warning with the default copy and a red
//      "제출" button. Cancel returns to the question; 제출 submits and ends
//      the survey with agreed=false, declined=true and no phone stored.
//   B  Q1 = No: the warning shows the author's custom notice instead of the
//      default copy; confirming submits and ends the survey.
//   C  Space-page poll overlay: Q1 = Yes → Q2 disagree shows the red Submit
//      warning and ends the survey.
//   Results count the two disagreements.
// ─────────────────────────────────────────────────────────────────────────────

test.describe.serial("Poll privacy-consent disagreement ends the survey", () => {
  test.setTimeout(240_000);

  let spaceId;
  let spaceUrl;
  let pollId;
  let pollActionId;

  const postTitle = `Poll Consent Termination E2E ${Date.now()}`;
  const postContents =
    "This post drives the poll privacy-consent termination Playwright spec. " +
    "It is long enough to satisfy the minimum content length the backend " +
    "enforces before a space can be spun up from the draft post.";

  const customNotice = "Thank you. This study is only open to adults, so the survey ends here.";
  const koDefaultCopy =
    "필수 동의 항목에 동의하지 않으셨으므로 본 설문을 계속 진행하실 수 없습니다. [제출] 버튼을 누르시면 조사가 종료됩니다. 위 내용을 확인하셨다면 [제출] 버튼을 눌러 주시기 바랍니다.";
  const enDefaultCopy =
    "Because you did not agree to a required consent item, you cannot continue with this survey. Pressing [Submit] will end the survey. If you have read the above, please press [Submit].";

  const pollUrl = () => `/spaces/${spaceId}/actions/polls/${pollId}`;
  const current = (page) => page.getByTestId("poll-current-question");

  async function getPoll(page) {
    const res = await page.request.get(`/api/spaces/${spaceId}/polls/${pollId}`);
    expect(res.ok(), `get poll: ${await res.text()}`).toBeTruthy();
    return res.json();
  }

  async function addChoiceQuestion(page, idx, title, options) {
    await page.getByTestId("poll-question-add").click();
    await expect(page.getByTestId(`poll-question-${idx}`)).toBeVisible();
    await fillQuestionTitle(page, `poll-question-${idx}-title`, title);
    for (let i = 0; i < options.length; i += 1) {
      const opt = page.getByTestId(`poll-question-${idx}-opt-${i}`).locator("input");
      await expect(opt).toBeVisible();
      await opt.fill(options[i]);
      await opt.press("Tab");
      await page.waitForTimeout(200);
    }
  }

  async function joinAsNewUser(browser, tag, { korean = false } = {}) {
    const { context, page } = await signUpViaApi(browser, tag);
    if (korean) {
      await page.addInitScript(() => window.localStorage.setItem("language", "ko"));
    }
    const join = await page.request.post(`/api/spaces/${spaceId}/participate`, {
      data: { body: { informed_agreed: true } },
    });
    expect(join.ok() || join.status() === 409, `participate: ${await join.text()}`).toBeTruthy();
    return { context, page };
  }

  async function openPollAsParticipant(page) {
    await goto(page, pollUrl());
    await expect(page.getByTestId("poll-read-next")).toBeVisible({ timeout: 20000 });
    await page.getByTestId("poll-read-next").click();
    await expect(current(page)).toBeVisible({ timeout: 20000 });
  }

  async function expectAt(page, idx) {
    await expect(current(page)).toHaveAttribute("data-question-index", String(idx));
  }

  async function expectRedConfirm(page, label) {
    const confirm = page.getByTestId("poll-terminate-confirm");
    await expect(confirm).toHaveText(label);
    await expect(confirm).toHaveAttribute("data-destructive", "true");
    const { bg, rgb } = await confirm.evaluate((el) => {
      const color = getComputedStyle(el).backgroundColor;
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return { bg: color, rgb: Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)) };
    });
    const [r, g, b] = rgb;
    expect(r, `confirm background ${bg} should be red`).toBeGreaterThan(180);
    expect(g, `confirm background ${bg} should be red`).toBeLessThan(120);
    expect(b, `confirm background ${bg} should be red`).toBeLessThan(120);
  }

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
      await page.locator("[contenteditable]").first().fill(postContents);
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

  test("Creator: consent question plus a custom termination notice on a choice question", async ({ page }) => {
    await createAction(page, spaceUrl, "poll", /\/actions\/polls\//);
    pollId = page.url().match(/\/actions\/polls\/([^/?#]+)/)[1];

    await fill(page, { placeholder: "Enter poll title..." }, "Research consent survey");
    await page.keyboard.press("Tab");

    await addChoiceQuestion(page, 0, "Are you 19 or older?", ["Yes", "No"]);
    await expect(page.getByTestId("poll-question-0-termination")).toHaveCount(0);
    await page.getByTestId("poll-question-0-terminate-1").click();
    await expect(page.getByTestId("poll-question-0-terminate-1")).toHaveAttribute("aria-pressed", "true");
    const notice = page.getByTestId("poll-question-0-termination-message");
    await expect(notice).toBeVisible();
    await notice.fill(customNotice);
    await notice.press("Tab");

    await page.getByTestId("poll-question-add").click();
    const consent = page.getByTestId("poll-question-1");
    await expect(consent).toBeVisible();
    await consent.getByText("Privacy Consent", { exact: true }).click();
    await expect(consent).toHaveAttribute("data-qtype", "privacy_consent");
    await fillQuestionTitle(page, "poll-question-1-title", "Research consent");
    const termsTitle = page.getByTestId("poll-question-1-terms-title");
    await termsTitle.fill("Personal information collection consent");
    await termsTitle.press("Tab");
    await expect(page.getByTestId("poll-question-1-termination-message")).toBeVisible();

    await addChoiceQuestion(page, 2, "Favorite season?", ["Spring", "Autumn"]);

    await expect
      .poll(
        async () => {
          const q = (await getPoll(page)).questions;
          return JSON.stringify({
            types: q.map((x) => x.answer_type),
            t0: q[0]?.terminate_on,
            m0: q[0]?.termination_message,
            m1: q[1]?.termination_message,
          });
        },
        { timeout: 15000 },
      )
      .toBe(
        JSON.stringify({
          types: ["single_choice", "privacy_consent", "single_choice"],
          t0: ["No"],
          m0: customNotice,
          m1: null,
        }),
      );

    await publishAction(page);
    const publishRes = await page.request.patch(`/api/spaces/${spaceId}`, {
      data: { req: { publish: true, visibility: "PUBLIC" } },
    });
    expect(publishRes.ok(), `publish space: ${await publishRes.text()}`).toBeTruthy();
    const startRes = await page.request.patch(`/api/spaces/${spaceId}`, { data: { req: { start: true } } });
    expect(startRes.ok(), `start space: ${await startRes.text()}`).toBeTruthy();
  });

  test("Participant A: disagreeing warns with the default copy and a red 제출, then ends the survey", async ({ browser }, testInfo) => {
    const { context, page } = await joinAsNewUser(browser, "pca", { korean: true });
    try {
      await openPollAsParticipant(page);
      await current(page).getByTestId("question-option-0").click();
      await expectAt(page, 1);

      await expect(page.getByTestId("pc-agree-option")).toHaveText("동의함");
      await expect(page.getByTestId("pc-disagree-option")).toHaveText("동의하지 않음");
      await expect(page.getByTestId("pc-phone-section")).toHaveCount(0);
      await page.getByTestId("pc-agree-option").click();
      await expect(page.getByTestId("pc-phone-section")).toBeVisible();

      await page.getByTestId("pc-disagree-option").click();
      await expect(page.getByText(koDefaultCopy, { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("poll-terminate-cancel")).toHaveText("취소");
      await expectRedConfirm(page, "제출");
      await testInfo.attach("privacy-consent-termination-popup", {
        body: await page.screenshot(),
        contentType: "image/png",
      });

      await page.getByTestId("poll-terminate-cancel").click();
      await expect(page.getByTestId("poll-terminate-confirm")).toHaveCount(0);
      await expectAt(page, 1);
      await expect(page.getByTestId("pc-agree-option")).toHaveAttribute("aria-checked", "true");
      expect((await getPoll(page)).my_response).toBeNull();

      await page.getByTestId("pc-disagree-option").click();
      await expectRedConfirm(page, "제출");
      await page.getByTestId("poll-terminate-confirm").click();
      await page.waitForURL(/\/spaces\/[^/]+\/actions\/?$/, { timeout: 30000 });

      const ans = (await getPoll(page)).my_response;
      expect(ans).not.toBeNull();
      expect(ans[0]).toMatchObject({ answer_type: "single_choice", answer: 0 });
      expect(ans[1]).toMatchObject({ answer_type: "privacy_consent", agreed: false, declined: true, phone: null });
      expect(ans[2]).toMatchObject({ answer_type: "single_choice", answer: null });
    } finally {
      await context.close();
    }
  });

  test("Participant B: a choice termination shows the author's custom notice", async ({ browser }) => {
    const { context, page } = await joinAsNewUser(browser, "pcb");
    try {
      await openPollAsParticipant(page);
      await current(page).getByTestId("question-option-1").click();
      await expect(page.getByText(customNotice, { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("This will end the survey", { exact: true })).toBeVisible();
      await expect(page.getByTestId("poll-terminate-confirm")).toHaveText("End survey");
      await expect(page.getByTestId("poll-terminate-confirm")).toHaveAttribute("data-destructive", "false");

      await page.getByTestId("poll-terminate-confirm").click();
      await page.waitForURL(/\/spaces\/[^/]+\/actions\/?$/, { timeout: 30000 });

      const ans = (await getPoll(page)).my_response;
      expect(ans).not.toBeNull();
      expect(ans[0]).toMatchObject({ answer_type: "single_choice", answer: 1 });
      expect(ans[1]).toMatchObject({ answer_type: "privacy_consent", agreed: false, declined: false, phone: null });
    } finally {
      await context.close();
    }
  });

  test("Participant C: space overlay ends the survey on a disagreement", async ({ browser }) => {
    const { context, page } = await joinAsNewUser(browser, "pcc");
    try {
      const actionsRes = await page.request.get(`/api/spaces/${spaceId}/actions`);
      expect(actionsRes.ok(), `list actions: ${await actionsRes.text()}`).toBeTruthy();
      pollActionId = (await actionsRes.json()).find((a) => a.action_type === "Poll").action_id;

      await goto(page, spaceUrl);
      await page.getByTestId(`quest-card-${pollActionId}`).click();
      await expect(page.getByTestId("poll-arena-overlay")).toBeVisible({ timeout: 20000 });
      await page.getByTestId("poll-arena-begin").click();
      await expect(page.getByTestId("poll-arena-question")).toBeVisible({ timeout: 20000 });
      await page.getByTestId("poll-arena-question").getByTestId("poll-arena-option-0").click();
      await expect(page.getByTestId("poll-arena-question")).toHaveAttribute("data-question-index", "1");

      await page.getByTestId("pc-disagree-option").click();
      await expect(page.getByTestId("poll-terminate-description")).toHaveText(enDefaultCopy);
      await expectRedConfirm(page, "Submit");
      await page.getByTestId("poll-terminate-confirm").click();
      await expect(page.getByTestId("poll-arena-overlay")).toBeHidden({ timeout: 30000 });

      const ans = (await getPoll(page)).my_response;
      expect(ans).not.toBeNull();
      expect(ans[1]).toMatchObject({ answer_type: "privacy_consent", agreed: false, declined: true, phone: null });
    } finally {
      await context.close();
    }
  });

  test("Server: a declined consent needs no phone, an agreed one still does", async ({ browser }) => {
    const { context, page } = await joinAsNewUser(browser, "pcd");
    try {
      const agreedNoPhone = await page.request.post(`/api/spaces/${spaceId}/polls/${pollId}/respond`, {
        data: {
          req: {
            answers: [
              { answer_type: "single_choice", answer: 0, other: null },
              { answer_type: "privacy_consent", agreed: true, declined: false, phone: null, code: null },
              { answer_type: "single_choice", answer: 0, other: null },
            ],
          },
        },
      });
      expect(agreedNoPhone.ok(), "agreeing without a phone must be rejected").toBeFalsy();

      const declinedThenAnswered = await page.request.post(`/api/spaces/${spaceId}/polls/${pollId}/respond`, {
        data: {
          req: {
            answers: [
              { answer_type: "single_choice", answer: 0, other: null },
              { answer_type: "privacy_consent", agreed: false, declined: true, phone: null, code: null },
              { answer_type: "single_choice", answer: 0, other: null },
            ],
          },
        },
      });
      expect(declinedThenAnswered.ok(), "answers after a declined consent must be rejected").toBeFalsy();

      const declined = await page.request.post(`/api/spaces/${spaceId}/polls/${pollId}/respond`, {
        data: {
          req: {
            answers: [
              { answer_type: "single_choice", answer: 0, other: null },
              { answer_type: "privacy_consent", agreed: false, declined: true, phone: null, code: null },
              { answer_type: "single_choice", answer: null, other: null },
            ],
          },
        },
      });
      expect(declined.ok(), `declined consent must be accepted: ${await declined.text()}`).toBeTruthy();
    } finally {
      await context.close();
    }
  });

  test("Creator: results count the disagreements", async ({ page }) => {
    await expect
      .poll(
        async () => {
          const res = await page.request.get(`/api/spaces/${spaceId}/polls/${pollId}/results`);
          if (!res.ok()) return null;
          const consent = (await res.json()).summaries?.[1];
          return consent ? JSON.stringify(consent) : null;
        },
        { timeout: 15000 },
      )
      .toBe(JSON.stringify({ answer_type: "privacy_consent", total_count: 3, agreed_count: 0, declined_count: 3 }));
  });
});
