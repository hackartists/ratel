import { test, expect } from "@playwright/test";
import { click, goto, waitPopup } from "../utils";

/**
 * Phone login: country-code combobox + E.164 formatting
 *
 * Covers the fix for dev's broken phone SMS login: the phone input now goes
 * through `components/ui/phone-input.tsx` (`react-phone-number-input`),
 * which renders the national number grouped per the selected country
 * (Korean mobile grouped 3-4-4 with hyphens) while handing
 * `actions.sendPhoneCode` a plain E.164 string with no separators — the
 * format AWS SNS's `publish().phone_number(...)` requires
 * (app/ratel/src/features/auth/controllers/send_code.rs).
 *
 * Asserts against the actual `send_code` network request body, not just the
 * displayed input value, so a regression that reintroduces raw/national-
 * format phone numbers in the request is caught. Expected E.164 strings are
 * built from parts at runtime rather than written as literals.
 *
 * NOTE: Requires backend built with `--features bypass` so code verification
 * isn't exercised here; this spec stops at the send-code request.
 */

function e164(countryCallingCode, nationalDigits) {
  return `+${countryCallingCode}${nationalDigits}`;
}

test.describe("Phone login: country select + E.164 formatting", () => {
  test.beforeEach(async ({ context }) => {
    // Fresh, unauthenticated context per test.
    await context.clearCookies();
  });

  test("Korean mobile number is grouped 3-4-4 with hyphens and sent as E.164", async ({
    page,
  }) => {
    await goto(page, "/");
    await click(page, { label: "Sign In" });
    await waitPopup(page, { visible: true });

    // Switch from the default email form to phone login.
    await click(page, { testId: "toggle-login-method" });

    const phoneInput = page.getByTestId("phone-input");
    await expect(phoneInput).toBeVisible();

    const nationalDigits = ["010", "1234", "5678"].join("");
    await phoneInput.fill(nationalDigits);

    // Displayed value is grouped 3-4-4 with hyphens, not the raw digits.
    await expect(phoneInput).toHaveValue(["010", "1234", "5678"].join("-"));

    // The actual network request must carry hyphen-free E.164, not the
    // display string and not the raw national-format input.
    const sendCodeRequest = page.waitForRequest(
      (req) => req.url().includes("send_code") || req.url().includes("send-code"),
    );
    await click(page, { testId: "phone-continue-button" });
    const request = await sendCodeRequest;
    const body = request.postDataJSON();
    const phone = body?.phone ?? body?.req?.phone;

    expect(phone).toBe(e164("82", nationalDigits));
    expect(phone).not.toContain("-");
  });

  test("switching country updates the calling code and national grouping", async ({
    page,
  }) => {
    await goto(page, "/");
    await click(page, { label: "Sign In" });
    await waitPopup(page, { visible: true });
    await click(page, { testId: "toggle-login-method" });

    const countrySelect = page.getByTestId("phone-input-country");
    await expect(countrySelect).toBeVisible();

    // Switch from the default KR to US and type a US-format national number.
    await countrySelect.selectOption("US");
    const phoneInput = page.getByTestId("phone-input");
    const nationalDigits = ["213", "373", "4253"].join("");
    await phoneInput.fill(nationalDigits);

    await expect(phoneInput).toHaveValue("(213) 373-4253");

    const sendCodeRequest = page.waitForRequest(
      (req) => req.url().includes("send_code") || req.url().includes("send-code"),
    );
    await click(page, { testId: "phone-continue-button" });
    const request = await sendCodeRequest;
    const body = request.postDataJSON();
    const phone = body?.phone ?? body?.req?.phone;

    expect(phone).toBe(e164("1", nationalDigits));
  });
});
