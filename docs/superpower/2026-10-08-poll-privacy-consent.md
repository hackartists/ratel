# Poll Privacy-Consent Question — System Design

**Roadmap**: [roadmap/poll-privacy-consent.md](../../roadmap/poll-privacy-consent.md)
**Design**: [/designs/poll-privacy-consent/](../../app/ratel/assets/design/poll-privacy-consent/)
**Author / Date**: Claude (subagent) · 2026-10-08

## Summary

Adds a `privacy_consent` poll question type. The designer authors consent
terms (title + rich-text HTML body) in the existing editor; respondents must
check "I agree" and verify a phone number via SMS code before the poll can
be submitted. The server re-verifies the phone+code against the existing
`PhoneVerification` record — it never trusts the client's "verified" flag.
The phone number is stored plaintext in `SpacePollUserAnswer`, exactly like
every other poll answer type.

## Data model

No new tables. `PrivacyConsentQuestion` / the new `Answer::PrivacyConsent`
variant are embedded jsonb inside the existing `space_polls.questions`
(`PollQuestions`) and `space_poll_user_answers.answers` (`PollUserAnswers`)
columns (see `app/ratel/src/features/spaces/pages/actions/actions/poll/models/{space_poll,space_poll_user_answer}.rs`).

```rust
// types/question.rs
pub enum Question {
    // ...existing variants...
    PrivacyConsent(PrivacyConsentQuestion),
}

pub struct PrivacyConsentQuestion {
    pub title: String,
    pub description: Option<String>,
    pub terms_title: String,
    /// Rich-text HTML, same convention as other HTML content fields
    /// (see `common::types::content::document` RichText pattern — here
    /// stored directly as a sanitized HTML string, matching how
    /// `SpacePoll.description`/`poll.description` are already stored).
    pub terms_body_html: String,
    pub is_required: Option<bool>,
}
```

```rust
// types/answer.rs
pub enum Answer {
    // ...existing variants...
    PrivacyConsent {
        agreed: bool,
        phone: Option<String>,
        /// The SMS code the client submitted for this phone at submit time.
        /// Not persisted — stripped after server-side re-verification succeeds.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        code: Option<String>,
    },
}
```

Only `agreed` + `phone` need to be retained once submission succeeds
(matching requirement 8: "Phone stored plaintext in SpacePollUserAnswer like
other answers"). `code` round-trips in the request DTO (`RespondPollRequest`)
and is consumed by server-side re-verification in `respond_poll`; it is
cleared to `None` before the `Answer` is persisted in
`SpacePollUserAnswer.answers`, so verification codes never sit in storage.

Existing tables reused as-is:
- `PhoneVerification` (`app/ratel/src/features/auth/models/phone_verification.rs`) — `find_by_phone`, `value`, `expired_at`, `attempt_count`.
- `UserPhoneNumber` (`app/ratel/src/features/auth/models/user_phone_number.rs`) — `find_by_user_pk`-style lookup to prefill a verified number for a logged-in user. (Current API only has `find_by_phone_number`; this feature adds `UserPhoneNumber::find_by_user_pk` for the prefill lookup — see API surface.)

## API surface

No new routes. Existing poll routes carry the new variant transparently
through their already-generic `Vec<Question>` / `Vec<Answer>` payloads:

- `POST /api/spaces/{space_id}/polls/{poll_id}` (`update_poll`) — `UpdatePollRequest::Question { questions }` now accepts `Question::PrivacyConsent`.
- `POST /api/spaces/{space_id}/polls/{poll_id}/respond` (`respond_poll`) — `RespondPollRequest.answers` now accepts `Answer::PrivacyConsent`.

One new read endpoint for the prefill requirement:

```rust
#[get("/api/auth/me/phone", user: crate::features::auth::User)]
pub async fn get_my_phone_handler() -> Result<GetMyPhoneResponse>

pub struct GetMyPhoneResponse {
    pub phone_number: Option<String>,
}
```

Reuses existing send/verify endpoints for the SMS flow (no new ones needed):
- `POST /api/auth/verification/send-verification-code` (`SendCodeRequest::SMS { phone }`)
- `POST /api/auth/verification/verify-code` (`VerifyCodeRequest::Phone { phone, code }`) — used by the client to give the user instant feedback; **not** trusted by `respond_poll`, which re-runs the same check server-side.

### Server-side re-verification (requirement 6)

In `respond_poll`, before `validate_answers`, for every
`Answer::PrivacyConsent { agreed, phone, code }`:

1. `agreed` must be `true`.
2. `phone` must be `Some(..)`.
3. `PhoneVerification::find_by_phone(phone)` must return a row whose `value == code` and `expired_at` has not passed (same checks as `verify_phone_code_handler` in `features/auth/controllers/verify_code.rs`, factored into a shared helper `verify_phone_code(phone, code) -> Result<()>` that both call).
4. On success, the `code` field is cleared (`None`) before the answer is persisted.
5. On any failure → `SpacePollError::PhoneVerificationFailed` (new variant, `BAD_REQUEST`).

`validate_answers` (types/answer.rs) adds a `(Question::PrivacyConsent(q), Answer::PrivacyConsent { agreed, phone, .. })` arm: when `is_required` (always required per roadmap non-goals — no per-question toggle to disable collection, but `is_required` still gates whether the question *must* be answered at all, consistent with every other question type), rejects when `!agreed` or `phone.is_none()`.

## Frontend architecture

- **Designer (content card)**: `PollContentCard` (`apps/web/.../poll-content-card.tsx`) gains a fifth segmented-control option "Privacy Consent" alongside single/multi/subjective/linear. A new `PrivacyConsentBody` sub-component renders terms-title input + the shared `Editor` (`@/components/editor/editor` `onContentChange` → `terms_body_html`).
- **Participant (response view)**: `QuestionViewer` (`apps/web/src/components/space-actions/question-viewer.tsx`) gains a `case "privacy_consent"` rendering a new `PrivacyConsentViewer`:
  - Renders terms (`dangerouslySetInnerHTML` of `terms_body_html`, same pattern as poll description).
  - "I agree" checkbox gates the phone section (`data-disabled`).
  - On mount, calls `getMyPhoneHandler()` (new ts-bridge hook `useGetMyPhone`) — if present, shows the prefilled/verified state with a "Change" button; otherwise starts directly in entry mode.
  - Entry mode: phone input + "Send code" (`useSendCode` with `SendCodeRequest::SMS`), code input + "Verify" (`useVerifyCode` with `VerifyCodeRequest::Phone`) for immediate UX feedback only. The verified `code` is kept in local state and included in the `Answer::PrivacyConsent` payload sent to `respond_poll` — the server re-verifies it independently.
  - `hasAnswerForQuestion`/`shouldAutoNext` in `question-viewer.tsx` get a `case "privacy_consent"` (answered when `agreed && phone !== null`; no auto-next).
- No new routes; reuses `FullActionLayover` poll flow unchanged.

## Test plan

- **Server (`app/ratel/src/tests/poll_privacy_consent_tests.rs`, new, registered in `tests/mod.rs`)**:
  - `validate_answers` accepts a valid `PrivacyConsent` answer (agreed + phone) against an `is_required` question.
  - `validate_answers` rejects `agreed: false` when required.
  - `validate_answers` rejects `phone: None` when required.
  - `respond_poll` integration: submitting with a real `PhoneVerification` row + correct code succeeds and `SpacePollUserAnswer.answers` contains the phone with `code: None`.
  - `respond_poll` integration: wrong code → `SpacePollError::PhoneVerificationFailed`, no answer persisted.
  - `respond_poll` integration: expired verification → rejected.
  - `create_poll`/`update_poll` round-trip a `PrivacyConsent` question through `UpdatePollRequest::Question`.
- **Playwright** (`playwright/tests/web/poll-privacy-consent.spec.ts`, new, following `conventions/playwright-tests.md`):
  - Designer adds a privacy_consent question, types terms via the editor, question persists after reload.
  - Participant sees terms, submit is disabled until agreement checked.
  - Participant with a verified phone sees it prefilled; "Change" switches to entry mode.
  - Participant enters phone, verifies with a test code, submits successfully.
  - Submitting with an invalid/stale code is rejected (toast/error shown).

## Open questions / risks

- Phone number format validation (country code, normalization) is left to the existing `SendCodeRequest::SMS`/login flow conventions — no new validation added here.
- Rate limiting on `send-verification-code` already exists (`MAX_ATTEMPT_COUNT`, `ATTEMPT_BLOCK_TIME`) and is reused as-is; no poll-specific rate limit added.
