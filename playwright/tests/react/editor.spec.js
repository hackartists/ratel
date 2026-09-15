import { test, expect } from "@playwright/test";
import { goto, clickNoNav } from "../utils";

// The shared rich-text editor ported to React (apps/web/src/components/editor),
// driven through its dev-only harness (apps/web/src/components/editor/__harness__),
// which the not-found page mounts at `?__editor_harness=1` in `vite dev` only:
//
//   VITE_API_TARGET=http://localhost:8080 corepack pnpm -C apps/web exec vite --port 5177
//   REACT_APP=1 PLAYWRIGHT_BASE_URL=http://localhost:5177 \
//     npx playwright test tests/react/editor.spec.js --project=React
//
// Against a production build (`vite preview`) the harness does not exist, so
// every test skips.
//
// The editor's behaviour is the Dioxus editor's script.js, loaded unmodified;
// these checks make sure the React markup and bridges keep it working: the
// markdown shortcuts mirror tests/web/editor-markdown-shortcuts.spec.js.

const HARNESS = "/no/such/page?__editor_harness=1";

async function openHarness(page, params = {}) {
  const query = new URLSearchParams(params).toString();
  await goto(page, query ? `${HARNESS}&${query}` : HARNESS);
  const harness = page.getByTestId("editor-harness");
  await expect(harness.or(page.getByRole("heading", { name: "Page not found" }))).toBeVisible();
  test.skip(!(await harness.isVisible()), "the editor harness only exists in vite dev builds");
  const root = page.locator('.ratel-editor[data-bound="true"]');
  await expect(root).toBeAttached();
  return { root, editor: root.locator(".re-content") };
}

/** Clean empty paragraph with the caret in it (same reset as the Dioxus spec). */
async function resetBody(page) {
  await page.evaluate(() => {
    const ed = document.querySelector(".re-content");
    ed.innerHTML = "<p><br></p>";
    const r = document.createRange();
    r.setStart(ed.firstChild, 0);
    r.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    ed.focus();
  });
}

/** Selects all text of the first element matching `selector` inside the editor and focuses it. */
async function selectText(page, selector) {
  await page.evaluate((sel) => {
    const ed = document.querySelector(".re-content");
    const target = ed.querySelector(sel);
    ed.focus();
    const r = document.createRange();
    r.selectNodeContents(target);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }, selector);
}

/** `onContentChange` output equals the script's HTML for the body. */
async function expectReportedHtml(page, editor) {
  await expect
    .poll(async () => {
      const [reported, actual] = await Promise.all([
        page.getByTestId("editor-harness-html").textContent(),
        editor.evaluate((el) => el.innerHTML),
      ]);
      return reported === actual ? actual : `reported ${reported} != body ${actual}`;
    })
    .not.toContain("reported ");
}

test.describe("React editor: mounting and the change bridge", () => {
  test("script binds the editor and reports the initial HTML", async ({ page }) => {
    const { root, editor } = await openHarness(page, { content: "<p>Hello <b>world</b></p>" });
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor).toHaveAttribute("data-placeholder", "Type here...");
    await expect(editor).toHaveAttribute("data-empty", "false");
    await expect(page.getByTestId("editor-harness-html")).toHaveText("<p>Hello <b>world</b></p>");
    await expect(root.locator(".re-word-count")).toHaveText("2");
    await expect(root.locator(".re-slash-bridge")).toHaveCount(0);
    await expect(root).toHaveAttribute("data-slash", "false");
  });

  test("typing reaches onContentChange with the script's HTML, across re-renders", async ({ page }) => {
    const { root, editor } = await openHarness(page);
    await expect(editor).toHaveAttribute("data-empty", "true");
    await resetBody(page);
    const before = Number(await page.getByTestId("editor-harness-changes").textContent());
    await page.keyboard.type("hello there");
    await expect(editor).toHaveText("hello there");
    await expectReportedHtml(page, editor);
    expect(Number(await page.getByTestId("editor-harness-changes").textContent())).toBeGreaterThan(before);
    // Every change re-renders the harness; the body (and caret) must survive it.
    await page.keyboard.type(" again");
    await expect(editor).toHaveText("hello there again");
    await expectReportedHtml(page, editor);
    await expect(root.locator(".re-word-count")).toHaveText("3");
  });

  test("an emptied body reports an empty string", async ({ page }) => {
    const { editor } = await openHarness(page, { content: "<p>x</p>" });
    await selectText(page, "p");
    await page.keyboard.press("Backspace");
    await expect(editor).toHaveAttribute("data-empty", "true");
    await expect(page.getByTestId("editor-harness-html")).toHaveText("");
  });

  test("remounting with a new key replaces the content and re-binds", async ({ page }) => {
    const { editor } = await openHarness(page, { content: "<p>first</p>" });
    await resetBody(page);
    await page.keyboard.type("typed");
    await expectReportedHtml(page, editor);
    await clickNoNav(page, { testId: "editor-harness-remount" });
    const fresh = page.locator('.ratel-editor[data-bound="true"] .re-content');
    await expect(fresh).toHaveCount(1);
    await expect.poll(() => fresh.evaluate((el) => el.innerHTML)).toBe("<h2>Replaced</h2><p>after remount</p>");
    // The new root's initial emitChange reached the new listener.
    await expect(page.getByTestId("editor-harness-html")).toHaveText("<h2>Replaced</h2><p>after remount</p>");
  });

  test("viewer mode renders no toolbar and a read-only body", async ({ page }) => {
    const { root, editor } = await openHarness(page, { content: "<p>read only</p>", editable: "false" });
    await expect(root).toHaveAttribute("data-editable", "false");
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await expect(root.locator(".re-toolbar, .re-mobile-bar, .re-fmt-sheet, .re-statusbar")).toHaveCount(0);
    await expect(page.getByTestId("editor-harness-html")).toHaveText("");
  });

  test("insert-data button calls onInsertData", async ({ page }) => {
    const { root } = await openHarness(page, { insertData: "Insert data" });
    await root.getByRole("toolbar", { name: "Editor toolbar" }).getByRole("button", { name: "Insert data" }).click();
    await expect(page.getByTestId("editor-harness-insert-data")).toHaveText("1");
  });
});

test.describe("React editor: toolbar", () => {
  test("block dropdown turns the line into a heading", async ({ page }) => {
    const { root, editor } = await openHarness(page, { content: "<p>Make me a heading</p>" });
    await selectText(page, "p");
    const toolbar = root.getByRole("toolbar", { name: "Editor toolbar" });
    await toolbar.locator(".re-block__btn").click();
    await expect(toolbar.locator(".re-block")).toHaveAttribute("data-open", "true");
    await toolbar.getByRole("button", { name: "Heading 2" }).click();
    await expect(editor.locator("h2")).toHaveText("Make me a heading");
    await expectReportedHtml(page, editor);
  });

  test("Bold applies and lights its button", async ({ page }) => {
    const { root, editor } = await openHarness(page, { content: "<p>bold me</p>" });
    await selectText(page, "p");
    const bold = root.getByRole("toolbar", { name: "Editor toolbar" }).getByRole("button", { name: "Bold" });
    await bold.click();
    await expect(editor.locator("b, strong")).toHaveText("bold me");
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await expectReportedHtml(page, editor);
  });
});

test.describe("React editor: slash signal", () => {
  test("`/word` opens the consumer menu and an option replaces the token", async ({ page }) => {
    const { root, editor } = await openHarness(page, { slash: "" });
    await expect(root).toHaveAttribute("data-slash", "true");
    await expect(root.locator(".re-slash-bridge")).toHaveCount(1);
    await resetBody(page);
    await page.keyboard.type("Intro /div");
    const menu = page.getByTestId("editor-harness-slash-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("data-placement", /^(below|above)$/);
    const signal = JSON.parse(await page.getByTestId("editor-harness-slash").textContent());
    expect(signal.raw).toBe("/div");
    expect(signal.caretX).toBeGreaterThan(0);
    expect(signal.caretY).toBeGreaterThan(0);

    await clickNoNav(page, { testId: "editor-harness-slash-divider" });
    await expect(editor.locator("hr")).toHaveCount(1);
    await expect(editor).not.toContainText("/div");
    await expect(editor).toContainText("Intro");
    await expect(menu).toBeHidden();
    await expectReportedHtml(page, editor);
    expect(await page.getByTestId("editor-harness-html").textContent()).toContain("<hr>");
  });

  test("whitespace after the token clears the signal", async ({ page }) => {
    await openHarness(page, { slash: "" });
    await resetBody(page);
    await page.keyboard.type("/data");
    await expect(page.getByTestId("editor-harness-slash-menu")).toBeVisible();
    await page.keyboard.type(" ");
    await expect(page.getByTestId("editor-harness-slash-menu")).toBeHidden();
    await expect(page.getByTestId("editor-harness-slash")).toHaveText(/"raw":""/);
  });
});

test.describe("React editor: mobile format sheet", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  async function openSheet(page, root) {
    await selectText(page, "p");
    await root.getByRole("toolbar", { name: "Format" }).getByRole("button", { name: "Format" }).click();
    await expect(root.locator(".re-fmt-sheet")).toHaveAttribute("data-open", "true");
    return root.getByRole("dialog", { name: "Format" });
  }

  // Past the script's 120ms debounced sync — and the harness re-render each
  // change triggers — nothing may switch a lit button back off (b05a78aa1).
  const PAST_DEBOUNCE_MS = 800;

  test("heading, then italic and underline, stay lit after applying", async ({ page }) => {
    const { root, editor } = await openHarness(page, { content: "<p>Styled line</p>" });
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    await expect(root.locator(".re-toolbar")).toBeHidden();
    const panel = await openSheet(page, root);

    const h1 = panel.getByRole("button", { name: "Heading 1" });
    await h1.click();
    await expect(editor.locator("h1")).toHaveText("Styled line");
    await expect(h1).toHaveClass(/re-block__item--active/);

    // Bold is deliberately not used here: a heading is already bold, so the
    // command un-bolds it and the button correctly stays off (same in Dioxus).
    const italic = panel.getByRole("button", { name: "Italic" });
    await italic.click();
    await expect(italic).toHaveAttribute("aria-pressed", "true");
    const underline = panel.getByRole("button", { name: "Underline" });
    await underline.click();
    await expect(underline).toHaveAttribute("aria-pressed", "true");

    await page.waitForTimeout(PAST_DEBOUNCE_MS);
    await expect(italic).toHaveAttribute("aria-pressed", "true");
    await expect(underline).toHaveAttribute("aria-pressed", "true");
    await expect(h1).toHaveClass(/re-block__item--active/);
    await expect(root.locator(".re-fmt-sheet")).toHaveAttribute("data-open", "true");

    await expect(editor.locator("h1 i u, h1 u i")).toHaveText("Styled line");
    await expectReportedHtml(page, editor);
  });

  test("bold on a paragraph stays lit and Done closes the sheet", async ({ page }) => {
    const { root, editor } = await openHarness(page, { content: "<p>Plain line</p>" });
    const panel = await openSheet(page, root);
    const bold = panel.getByRole("button", { name: "Bold" });
    await bold.click();
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(PAST_DEBOUNCE_MS);
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await expect(editor.locator("p b, p strong")).toHaveText("Plain line");

    // `data-fmt-close` handler; the scrim sits over the head during the
    // sheet's transition, so dispatch the click on the button itself.
    await panel.getByRole("button", { name: "Done" }).dispatchEvent("click");
    await expect(root.locator(".re-fmt-sheet")).toHaveAttribute("data-open", "false");
    await expectReportedHtml(page, editor);
  });
});

test.describe("React editor: Korean IME composition", () => {
  test("composition holds changes until commit and keeps the caret", async ({ page }) => {
    const { root, editor } = await openHarness(page);
    await resetBody(page);
    const cdp = await page.context().newCDPSession(page);
    const changes = page.getByTestId("editor-harness-changes");

    // Longer than the script's 120ms change debounce.
    const SETTLE_MS = 400;
    const compose = async (steps, commit) => {
      // Let any change from the previous edit land before taking the baseline.
      await page.waitForTimeout(SETTLE_MS);
      const baseline = await changes.textContent();
      for (const text of steps) {
        await cdp.send("Input.imeSetComposition", { text, selectionStart: text.length, selectionEnd: text.length });
      }
      await expect(root).toHaveAttribute("data-composing", "true");
      await page.waitForTimeout(SETTLE_MS);
      // No change is emitted while a syllable is still being composed.
      await expect(changes).toHaveText(baseline);
      await cdp.send("Input.insertText", { text: commit });
      await expect(root).toHaveAttribute("data-composing", "false");
      // The commit (compositionend) emits exactly once the debounce runs out.
      await expect(changes).not.toHaveText(baseline);
    };

    await compose(["ㅎ", "하", "한"], "한");
    await compose(["ㄱ", "그", "글"], "글");
    await expect(editor).toHaveText("한글");
    await expectReportedHtml(page, editor);
    expect(await page.getByTestId("editor-harness-html").textContent()).toContain("한글");

    // The harness re-rendered on each commit; typing continues at the caret.
    await page.keyboard.type(" ok");
    await expect(editor).toHaveText("한글 ok");
    await expectReportedHtml(page, editor);

    // A markdown marker typed during composition is not converted.
    await resetBody(page);
    await cdp.send("Input.imeSetComposition", { text: "#", selectionStart: 1, selectionEnd: 1 });
    await cdp.send("Input.imeSetComposition", { text: "# ", selectionStart: 2, selectionEnd: 2 });
    await expect(editor.locator("h1")).toHaveCount(0);
    await cdp.send("Input.insertText", { text: "# " });
    await expect(root).toHaveAttribute("data-composing", "false");
  });
});

test.describe("React editor: markdown shortcuts", () => {
  async function open(page) {
    const { editor } = await openHarness(page);
    await resetBody(page);
    return editor;
  }

  test("# → H1 (empty paragraph)", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("# ");
    await page.keyboard.type("Title");
    await expect(editor.locator("h1")).toHaveText("Title");
    await expectReportedHtml(page, editor);
  });

  test("## → H2", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("## Heading2");
    await expect(editor.locator("h2")).toHaveText("Heading2");
  });

  test("### → H3", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("### Sub");
    await expect(editor.locator("h3")).toHaveText("Sub");
  });

  test("# prepended to existing text preserves the rest of the line", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("Hello world");
    await page.keyboard.press("Home");
    await page.keyboard.type("# ");
    await expect(editor.locator("h1")).toHaveText("Hello world");
  });

  test("Mid-line # is not converted", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("abc# x");
    await expect(editor.locator("h1")).toHaveCount(0);
    await expect(editor).toContainText("abc# x");
  });

  test("# inside an existing H1 is typed literally", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("# Title");
    await expect(editor.locator("h1")).toHaveText("Title");
    await page.keyboard.press("Home");
    await page.keyboard.type("# ");
    await expect(editor.locator("h1")).toHaveText("# Title");
    await expect(editor.locator("h1 h1")).toHaveCount(0);
  });

  test("- → <ul>", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("- Apple");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Banana");
    await expect(editor.locator("ul > li")).toHaveCount(2);
    await expect(editor.locator("ul > li").nth(0)).toHaveText("Apple");
    await expect(editor.locator("ul > li").nth(1)).toHaveText("Banana");
  });

  test("* → <ul> (asterisk variant)", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("* item");
    await expect(editor.locator("ul > li")).toHaveText("item");
  });

  test("+ → <ul> (plus variant)", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("+ item");
    await expect(editor.locator("ul > li")).toHaveText("item");
  });

  test("1. → <ol>", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("1. first");
    await page.keyboard.press("Enter");
    await page.keyboard.type("second");
    await expect(editor.locator("ol > li")).toHaveCount(2);
    await expect(editor.locator("ol > li").nth(0)).toHaveText("first");
    await expect(editor.locator("ol > li").nth(1)).toHaveText("second");
  });

  test("7. → <ol> (custom number is discarded, list starts at 1)", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("7. seven");
    await expect(editor.locator("ol > li")).toHaveText("seven");
    expect(await editor.locator("ol").getAttribute("start")).toBeNull();
  });

  test("Tab inside <li> nests deeper", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("- Outer");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Inner");
    await expect(editor.locator("ul > li > ul > li")).toHaveText("Inner");
  });

  test("Shift+Tab un-nests back one level", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("- Outer");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Inner");
    await page.keyboard.press("Enter");
    await page.keyboard.down("Shift");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
    await page.keyboard.type("Back");
    await expect(editor.locator("ul > li")).toContainText(["Outer", "Back"]);
  });

  test("Enter on an empty <li> exits the list", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("- Item");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("After");
    await expect(editor.locator("ul > li")).toHaveCount(1);
    await expect(editor.locator("ul > li")).toHaveText("Item");
    await expect(editor.locator("ul")).not.toContainText("After");
    await expect(editor).toContainText("After");
  });

  test("> → <blockquote>", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("> Quoted");
    await expect(editor.locator("blockquote")).toContainText("Quoted");
  });

  test("``` → <pre> (third backtick triggers immediately)", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("```");
    await page.keyboard.type("console.log(1)");
    await expect(editor.locator("pre")).toHaveCount(1);
    await expect(editor.locator("pre")).toContainText("console.log(1)");
  });

  test("- inside <pre> is literal, not a list", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("```");
    await page.keyboard.type("- not a list");
    await expect(editor.locator("pre")).toContainText("- not a list");
    await expect(editor.locator("ul")).toHaveCount(0);
  });

  test("--- + space → <hr> followed by an empty paragraph", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("--- ");
    await page.keyboard.type("after");
    await expect(editor.locator("hr")).toHaveCount(1);
    expect(await editor.evaluate((el) => el.innerHTML)).toMatch(/<hr[^>]*>\s*<p[^>]*>after<\/p>/);
  });

  test("Backspace immediately after conversion reverts to literal marker", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("# ");
    await page.keyboard.press("Backspace");
    await expect(editor.locator("h1")).toHaveCount(0);
    await expect(editor).toContainText("# ");
  });

  test("Typing any character after conversion disarms the revert", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("# ");
    await page.keyboard.type("a");
    await expect(editor.locator("h1")).toHaveText("a");
    await page.keyboard.press("Backspace");
    await expect(editor.locator("h1")).toBeVisible();
    await expect(editor.locator("h1")).toHaveText("");
  });

  test("No conversion fires while IME composition is active", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      document.querySelector(".re-content").dispatchEvent(new CompositionEvent("compositionstart"));
    });
    await page.keyboard.type("# ");
    await expect(page.locator(".re-content h1")).toHaveCount(0);
    await expect(page.locator(".re-content")).toContainText("# ");
    await page.evaluate(() => {
      document.querySelector(".re-content").dispatchEvent(new CompositionEvent("compositionend"));
    });
  });

  test("# converts bare text at editor root (no <p>/<div> wrapper)", async ({ page }) => {
    const editor = await open(page);
    await page.evaluate(() => {
      const ed = document.querySelector(".re-content");
      ed.innerHTML = "";
      ed.focus();
    });
    await page.keyboard.type("# Title");
    await expect(editor.locator("h1")).toHaveText("Title");
  });

  test("``` inside an existing <pre> is literal, not a new <pre>", async ({ page }) => {
    const editor = await open(page);
    await page.keyboard.type("```");
    await expect(editor.locator("pre")).toHaveCount(1);
    await page.keyboard.type("```");
    await expect(editor.locator("pre")).toHaveCount(1);
    await expect(editor.locator("pre pre")).toHaveCount(0);
  });
});
