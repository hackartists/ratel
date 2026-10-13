import { expect, test } from "@playwright/test";
import { createAction, fill, fillQuestionTitle, goto, publishAction, signUpViaApi } from "../utils";

// ─────────────────────────────────────────────────────────────────────────────
// Poll conditional questions + termination options.
//
// Poll built by the creator through the editor:
//   Q1 (single)  Do you own a car?     Yes / No / Skip survey   — "Skip survey" ends the poll
//   Q2 (single)  Which brand?          Hyundai / Kia            — shown when Q1 = Yes
//   Q3 (single)  Planning to buy one?  Soon / Never             — shown when Q1 = No; "Never" ends the poll
//   Q4 (multi)   Which features matter? Safety / Price          — always shown
//   Q5 (single)  Crash rating weight?  High / Low               — shown when Q4 ∋ Safety OR Q3 = Soon
//
// Participants:
//   A  Yes path (Q2 shown, Q3 hidden) then switches Q1 to No: the Q2 answer is
//      dropped and the No path (Q3 → Q4 → Q5) is submitted.
//   B  Yes path end-to-end; Q5 appears through the multiple-choice OR rule.
//   C  Picks "Skip survey" on Q1: submitted at once, stored, action not completed.
//   D  Q1 = No, Q3 = "Never": submitted at once, action completed.
// ─────────────────────────────────────────────────────────────────────────────

test.describe.serial("Poll conditional questions and termination", () => {
  test.setTimeout(240_000);

  let spaceId;
  let spaceUrl;
  let pollId;
  let pollActionId;

  const postTitle = `Poll Branching E2E ${Date.now()}`;
  const postContents =
    "This post drives the poll conditional-question Playwright spec. It is " +
    "long enough to satisfy the minimum content length the backend enforces " +
    "before a space can be spun up from the draft post.";

  const QUESTIONS = [
    { title: "Do you own a car?", options: ["Yes", "No", "Skip survey"], type: "single" },
    { title: "Which brand?", options: ["Hyundai", "Kia"], type: "single" },
    { title: "Planning to buy one?", options: ["Soon", "Never"], type: "single" },
    { title: "Which features matter?", options: ["Safety", "Price"], type: "multi" },
    { title: "Crash rating weight?", options: ["High", "Low"], type: "single" },
  ];

  const pollUrl = () => `/spaces/${spaceId}/actions/polls/${pollId}`;

  async function getPoll(page) {
    const res = await page.request.get(`/api/spaces/${spaceId}/polls/${pollId}`);
    expect(res.ok(), `get poll: ${await res.text()}`).toBeTruthy();
    return res.json();
  }

  async function pollAction(page) {
    const res = await page.request.get(`/api/spaces/${spaceId}/actions`);
    expect(res.ok(), `list actions: ${await res.text()}`).toBeTruthy();
    const actions = await res.json();
    return actions.find((a) => a.action_type === "Poll");
  }

  async function addQuestion(page, idx, { title, options, type }) {
    await page.getByTestId("poll-question-add").click();
    const block = page.getByTestId(`poll-question-${idx}`);
    await expect(block).toBeVisible();
    if (type === "multi") {
      await block.getByTestId(`poll-question-${idx}-type`).getByText("Multi", { exact: true }).click();
      await expect(block).toHaveAttribute("data-qtype", "multi");
    }
    await fillQuestionTitle(page, `poll-question-${idx}-title`, title);
    for (let i = 0; i < options.length; i += 1) {
      if (i >= 2) {
        await page.getByTestId(`poll-question-${idx}-opt-add`).click();
      }
      const opt = page.getByTestId(`poll-question-${idx}-opt-${i}`).locator("input");
      await expect(opt).toBeVisible();
      await opt.fill(options[i]);
      await opt.press("Tab");
      await page.waitForTimeout(200);
    }
  }

  async function addCondition(page, idx, refIdx, values) {
    const condition = page.getByTestId(`poll-question-${idx}-condition`);
    await condition.getByTestId("btn-add-required-attribute").click();
    await page.getByTestId(new RegExp(`^required-attribute-candidate-.+-${refIdx}$`)).click();
    for (const v of values) {
      await condition.getByTestId(`required-attribute-value-${v}`).click();
    }
    await condition.getByTestId("btn-confirm-required-attribute").click();
    await expect(condition.getByTestId("required-attribute-value-picker")).toHaveCount(0);
  }

  async function openPollAsParticipant(page) {
    await goto(page, pollUrl());
    await expect(page.getByTestId("poll-read-next")).toBeVisible({ timeout: 20000 });
    await page.getByTestId("poll-read-next").click();
    await expect(page.getByTestId("poll-current-question")).toBeVisible({ timeout: 20000 });
  }

  const current = (page) => page.getByTestId("poll-current-question");

  async function expectAt(page, idx) {
    await expect(current(page)).toHaveAttribute("data-question-index", String(idx));
  }

  async function pick(page, optIdx) {
    await current(page).getByTestId(`question-option-${optIdx}`).click();
  }

  async function confirmSubmit(page) {
    const confirm = page.getByTestId(/poll-(read-)?confirm-submit/);
    await expect(confirm).toBeVisible({ timeout: 10000 });
    await confirm.click();
    await page.waitForURL(/\/spaces\/[^/]+\/actions\/?$/, { timeout: 30000 });
  }

  async function joinAsNewUser(browser, tag) {
    const { context, page } = await signUpViaApi(browser, tag);
    const join = await page.request.post(`/api/spaces/${spaceId}/participate`, {
      data: { body: { informed_agreed: true } },
    });
    expect(join.ok() || join.status() === 409, `participate: ${await join.text()}`).toBeTruthy();
    return { context, page };
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

  test("Creator: builds display conditions (AND/OR, multiple choice) and termination options", async ({ page }) => {
    await createAction(page, spaceUrl, "poll", /\/actions\/polls\//);
    pollId = page.url().match(/\/actions\/polls\/([^/?#]+)/)[1];

    await fill(page, { placeholder: "Enter poll title..." }, "Car survey");
    await page.keyboard.press("Tab");

    for (let i = 0; i < QUESTIONS.length; i += 1) {
      await addQuestion(page, i, QUESTIONS[i]);
    }

    await expect(page.getByTestId("poll-question-0-condition")).toHaveCount(0);

    await page.getByTestId("poll-question-0-terminate-2").click();
    await expect(page.getByTestId("poll-question-0-terminate-2")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("poll-question-2-terminate-1").click();
    await expect(page.getByTestId("poll-question-2-terminate-1")).toHaveAttribute("aria-pressed", "true");

    await addCondition(page, 1, 0, ["Yes"]);
    await addCondition(page, 2, 0, ["No"]);
    await addCondition(page, 4, 3, ["Safety"]);
    await addCondition(page, 4, 2, ["Soon"]);
    const q5 = page.getByTestId("poll-question-4-condition");
    await expect(q5.getByTestId(/^chip-required-attribute-/)).toHaveCount(2);
    await q5.getByTestId("condition-operator-or").click();
    await expect(q5.getByTestId("condition-operator-or")).toHaveAttribute("aria-checked", "true");

    await expect
      .poll(
        async () => {
          const poll = await getPoll(page);
          const q = poll.questions;
          return JSON.stringify({
            t0: q[0]?.terminate_on,
            c1: q[1]?.display_condition,
            c2: q[2]?.display_condition,
            t2: q[2]?.terminate_on,
            c3: q[3]?.display_condition,
            c4: q[4]?.display_condition,
          });
        },
        { timeout: 15000 },
      )
      .toBe(
        JSON.stringify({
          t0: ["Skip survey"],
          c1: { operator: "And", rules: [{ question_index: 0, allowed_values: ["Yes"] }] },
          c2: { operator: "And", rules: [{ question_index: 0, allowed_values: ["No"] }] },
          t2: ["Never"],
          c3: null,
          c4: {
            operator: "Or",
            rules: [
              { question_index: 3, allowed_values: ["Safety"] },
              { question_index: 2, allowed_values: ["Soon"] },
            ],
          },
        }),
      );

    const bad = await page.request.post(`/api/spaces/${spaceId}/polls/${pollId}`, {
      data: {
        req: {
          questions: (await getPoll(page)).questions.map((q, i) =>
            i === 1 ? { ...q, display_condition: { operator: "And", rules: [{ question_index: 3, allowed_values: ["Safety"] }] } } : q,
          ),
        },
      },
    });
    expect(bad.ok(), "a condition referencing a later question must be rejected").toBeFalsy();

    await publishAction(page);
    const publishRes = await page.request.patch(`/api/spaces/${spaceId}`, {
      data: { req: { publish: true, visibility: "PUBLIC" } },
    });
    expect(publishRes.ok(), `publish space: ${await publishRes.text()}`).toBeTruthy();
    const startRes = await page.request.patch(`/api/spaces/${spaceId}`, { data: { req: { start: true } } });
    expect(startRes.ok(), `start space: ${await startRes.text()}`).toBeTruthy();
  });

  test("Participant A: Yes path hides Q3; switching Q1 to No drops the Q2 answer", async ({ browser }) => {
    const { context, page } = await joinAsNewUser(browser, "a");
    try {
      await openPollAsParticipant(page);
      await expectAt(page, 0);
      await pick(page, 0);
      await expectAt(page, 1);
      await expect(page.getByTestId("poll-progress")).toContainText("2/3");
      await pick(page, 0);
      await expectAt(page, 3);
      await pick(page, 1);
      await expect(page.getByTestId("poll-submit")).toBeVisible();
      await expect(page.getByTestId("poll-next")).toHaveCount(0);

      await page.getByTestId("poll-prev").click();
      await expectAt(page, 1);
      await page.getByTestId("poll-prev").click();
      await expectAt(page, 0);
      await pick(page, 1);
      await expectAt(page, 2);
      await pick(page, 0);
      await expectAt(page, 3);
      await page.getByTestId("poll-next").click();
      await expectAt(page, 4);
      await pick(page, 0);
      await page.getByTestId("poll-submit").click();
      await confirmSubmit(page);

      const poll = await getPoll(page);
      const ans = poll.my_response;
      expect(ans).not.toBeNull();
      expect(ans[0].answer).toBe(1);
      expect(ans[1]).toMatchObject({ answer_type: "single_choice", answer: null });
      expect(ans[2].answer).toBe(0);
      expect(ans[3]).toMatchObject({ answer_type: "multiple_choice", answer: [1] });
      expect(ans[4].answer).toBe(0);
      const action = await pollAction(page);
      pollActionId = action.action_id;
      expect(action.user_participated).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("Participant B: Yes path end-to-end, Q5 shown via multiple-choice OR rule", async ({ browser }) => {
    const { context, page } = await joinAsNewUser(browser, "b");
    try {
      await openPollAsParticipant(page);
      await pick(page, 0);
      await expectAt(page, 1);
      await pick(page, 1);
      await expectAt(page, 3);
      await pick(page, 0);
      await page.getByTestId("poll-next").click();
      await expectAt(page, 4);
      await pick(page, 1);
      await page.getByTestId("poll-submit").click();
      await confirmSubmit(page);

      const ans = (await getPoll(page)).my_response;
      expect(ans.map((a) => a.answer)).toEqual([0, 1, null, [0], 1]);
      expect((await pollAction(page)).user_participated).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("Participant C: termination on Q1 submits at once and leaves the action incomplete", async ({ browser }) => {
    const { context, page } = await joinAsNewUser(browser, "c");
    try {
      await openPollAsParticipant(page);
      await pick(page, 2);
      await confirmSubmit(page);

      const ans = (await getPoll(page)).my_response;
      expect(ans).not.toBeNull();
      expect(ans.map((a) => a.answer)).toEqual([2, null, null, null, null]);
      expect((await pollAction(page)).user_participated).toBe(false);

      await goto(page, spaceUrl);
      await expect(page.getByTestId(`quest-card-${pollActionId}`)).toBeVisible({ timeout: 20000 });
    } finally {
      await context.close();
    }
  });

  test("Participant D: termination mid-poll submits at once and completes the action", async ({ browser }) => {
    const { context, page } = await joinAsNewUser(browser, "d");
    try {
      await openPollAsParticipant(page);
      await pick(page, 1);
      await expectAt(page, 2);
      await pick(page, 1);
      await confirmSubmit(page);

      const ans = (await getPoll(page)).my_response;
      expect(ans.map((a) => a.answer)).toEqual([1, null, 1, null, null]);
      expect((await pollAction(page)).user_participated).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("Server rejects answers to hidden questions", async ({ browser }) => {
    const { context, page } = await joinAsNewUser(browser, "e");
    try {
      const res = await page.request.post(`/api/spaces/${spaceId}/polls/${pollId}/respond`, {
        data: {
          req: {
            answers: [
              { answer_type: "single_choice", answer: 0, other: null },
              { answer_type: "single_choice", answer: 0, other: null },
              { answer_type: "single_choice", answer: 0, other: null },
              { answer_type: "multiple_choice", answer: [1], other: null },
              { answer_type: "single_choice", answer: null, other: null },
            ],
          },
        },
      });
      expect(res.ok(), "an answer to hidden Q3 must be rejected").toBeFalsy();
    } finally {
      await context.close();
    }
  });
});
