import { test, expect } from "@playwright/test";
import { createAction, fill, fillQuestionTitle, getEditor, goto } from "../utils";

/**
 * Quiz questions written in Korean save once the request body passes the
 * 2048-byte access-log preview. The request logger used to slice the body at
 * byte 2048, which panicked (and aborted the server) whenever that byte fell
 * inside a multi-byte character, so the creator only saw the generic
 * "unexpected error" toast.
 *
 * Creator: hi+user1@biyard.co (user.json).
 */
test.describe.serial("Quiz questions with multi-byte text", () => {
  test.describe.configure({ timeout: 240000 });

  const stamp = Date.now();
  const titles = [
    `기후 정책 공론조사에서 시민 패널이 가장 먼저 검토해야 할 자료는 무엇이라고 생각하는지 하나만 골라 주세요 ${stamp}`,
    `지역 에너지 전환 계획을 수립할 때 주민 참여를 늘리기 위해 가장 효과적인 방법은 무엇인지 하나만 골라 주세요 ${stamp}`,
    `공공 데이터 개방 정책이 시민의 정책 이해도를 높이는 데 기여하는 가장 큰 이유는 무엇인지 하나만 골라 주세요 ${stamp}`,
  ];
  const options = [
    ["정부가 발표한 공식 통계 자료와 연차 보고서", "전문가 집단이 작성한 독립적인 분석 보고서"],
    ["읍면동 단위의 주민 설명회와 온라인 의견 수렴", "지방자치단체 누리집에 계획안 원문을 공개"],
    ["원자료에 누구나 직접 접근해서 검증할 수 있음", "언론 보도를 거치지 않고 정책 근거를 확인함"],
  ];
  let spaceUrl;
  let quizUrl;
  let spaceId;
  let quizId;

  test("creator writes three Korean questions and they persist", async ({ page }) => {
    const postRes = await page.request.post("/api/posts", { data: {} });
    expect(postRes.ok(), `create post: ${await postRes.text()}`).toBeTruthy();
    const postPk = (await postRes.json()).post_pk;
    const postId = postPk.includes("#") ? postPk.split("#")[1] : postPk;

    await goto(page, `/posts/${postId}/edit`);
    await fill(page, { placeholder: "Title your post…" }, `Quiz multibyte ${stamp}`);
    const editor = await getEditor(page);
    await editor.fill(`Quiz multibyte ${stamp} — e2e`);
    await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 30000 });

    const spaceRes = await page.request.post("/api/spaces/create", {
      data: { req: { post_id: postId } },
    });
    expect(spaceRes.ok(), `create space: ${await spaceRes.text()}`).toBeTruthy();
    spaceId = (await spaceRes.json()).space_id;
    spaceUrl = `/spaces/${spaceId}`;

    await createAction(page, spaceUrl, "quiz", /\/actions\/quizzes\//);
    quizUrl = new URL(page.url()).pathname;
    quizId = decodeURIComponent(quizUrl.split("/actions/quizzes/")[1].split("/")[0]);

    const failedSaves = [];
    page.on("requestfailed", (req) => {
      if (req.url().includes("/quizzes/")) failedSaves.push(`${req.method()} ${req.url()} ${req.failure()?.errorText}`);
    });
    page.on("response", (res) => {
      if (res.request().method() === "POST" && res.url().includes("/quizzes/") && !res.ok()) {
        failedSaves.push(`${res.status()} ${res.url()}`);
      }
    });

    let lastSaveBytes = 0;
    for (let i = 0; i < titles.length; i += 1) {
      await page.getByTestId("quiz-question-add").click();
      await expect(page.getByTestId(`quiz-question-${i}`)).toBeVisible();
      await fillQuestionTitle(page, `quiz-question-${i}-title`, titles[i]);
      for (let o = 0; o < options[i].length; o += 1) {
        const input = page.getByTestId(`quiz-question-${i}-opt-${o}`).locator("input");
        await input.fill(options[i][o]);
        await input.press("Tab");
      }
      const saved = page.waitForResponse(
        (res) => res.request().method() === "POST" && res.url().includes("/quizzes/"),
      );
      await page.getByTestId(`quiz-question-${i}-opt-1`).locator(".q-opt__radio").click();
      const res = await saved;
      expect(res.ok(), `save question ${i}: ${res.status()}`).toBeTruthy();
      lastSaveBytes = res.request().postDataBuffer()?.length ?? 0;
    }

    expect(lastSaveBytes).toBeGreaterThan(2048);
    expect(failedSaves).toEqual([]);

    await page.reload({ waitUntil: "load" });
    for (let i = 0; i < titles.length; i += 1) {
      await expect(page.getByTestId(`quiz-question-${i}-title`)).toContainText(titles[i]);
      await expect(page.getByTestId(`quiz-question-${i}-opt-0`).locator("input")).toHaveValue(options[i][0]);
      await expect(page.getByTestId(`quiz-question-${i}-opt-1`)).toHaveAttribute("aria-checked", "true");
    }
  });

  test("a body whose 2048th byte splits a Korean character still gets a response", async ({ page }) => {
    const question = (title) => ({
      answer_type: "single_choice",
      title,
      html_title: null,
      description: null,
      image_url: null,
      options: ["가", "나"],
      is_required: null,
      allow_other: null,
      terminate_on: [],
      display_condition: null,
      termination_message: null,
    });
    const payload = (pad) => ({
      req: {
        title: null,
        description: null,
        retry_count: null,
        pass_score: null,
        questions: [question(`${"a".repeat(pad)}${"하".repeat(700)}`), question("둘"), question("셋")],
        answers: [
          { answer_type: "single", answer: 0 },
          { answer_type: "single", answer: 0 },
          { answer_type: "single", answer: 0 },
        ],
        files: null,
      },
    });
    const splitsAt2048 = (body) => {
      const bytes = Buffer.from(body);
      return bytes.length > 2048 && (bytes[2048] & 0xc0) === 0x80;
    };
    let body = "";
    for (let pad = 0; pad < 3; pad += 1) {
      body = JSON.stringify(payload(pad));
      if (splitsAt2048(body)) break;
    }
    expect(splitsAt2048(body)).toBeTruthy();

    const quizApi = `/api/spaces/${encodeURIComponent(spaceId)}/quizzes/${encodeURIComponent(quizId)}`;
    const res = await page.request.post(quizApi, { headers: { "content-type": "application/json" }, data: body });
    expect(res.ok(), `update quiz: ${res.status()} ${await res.text()}`).toBeTruthy();

    const quiz = await page.request.get(quizApi);
    expect(quiz.ok()).toBeTruthy();
    expect((await quiz.json()).questions[0].title).toContain("하".repeat(700));
  });
});
