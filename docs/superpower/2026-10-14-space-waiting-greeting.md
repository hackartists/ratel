# Space Waiting Greeting

**Author / Date**: Claude (subagent) · 2026-10-14

## Summary

Space admins can write a rich-text greeting at the top of the space settings panel. Candidates who have finished the prerequisites see it at the top of their waiting card (`WaitingCard`) and of the Sampling card (`SamplingEntryCard`). The greeting is a property of the space. It is separate from the Announcement action.

## What's changing

### Data model

- `SpaceCommon.greeting: String` (HTML), `#[serde(default)]`, Postgres `version = 3` on `space_commons`. The versioned migration adds `greeting TEXT NOT NULL DEFAULT ''`, so existing spaces get an empty greeting. No backfill is needed.
- `SpaceCommon::is_greeting_editable()` returns false once the status is `Ongoing`, `Processing` or `Finished`. Unpublished spaces (`None`), `Designing`, `Open` and `Sampling` stay editable.

### API

- `PATCH /api/spaces/{space_id}` accepts a new `UpdateSpaceRequest::Greeting { greeting }` variant. It is declared before `StartTime` because `StartTime` has only optional fields and would otherwise match `{"greeting": …}` under `untagged`.
  - Only the Creator role can use it, the same check as every other `update_space` variant.
  - Once the space has started, the request is rejected with `SpaceError::GreetingLocked` (400).
  - Inline `color:` styles are stripped with the existing `strip_color_styles` before saving, so the greeting stays readable in both themes.
- `SpaceResponse.greeting` and `UpdateSpaceResponse.greeting` expose the stored HTML.

### Frontend

- `GreetingSection` is the first section of `SettingsPanel` and is shown only when `isAdmin && spaceId`. It uses the shared `Editor` and a Save button. Save is disabled until the draft differs from the saved value. Once the space has started, the editor is read-only and the Save button is hidden.
- `WaitingGreeting` renders `space.greeting` with `dangerouslySetInnerHTML`, the same way the overview panel renders the space content. It renders nothing when the greeting is empty. It is placed at the top of `WaitingCard` and `SamplingEntryCard` in every `MySamplingState`.
- New i18n namespace `greetingSection` (en/ko) and a `SpaceError.GreetingLocked` enum string.

### Unchanged

- `CandidateView` routing. A user who joins after the space is `Ongoing` still goes straight to the dashboard, so they never see a waiting card or the greeting.
- The Announcement action.

## Test plan

- Unit (`space_common.rs`): `is_greeting_editable` for each status.
- Server (`tests/space_greeting_tests.rs`):
  - the greeting defaults to empty
  - the Creator can set the greeting in `None` / `Designing` / `Open` / `Sampling`, color styles are stripped, and `get_space` returns it
  - the greeting can be cleared
  - edits are rejected with 400 in `Ongoing` / `Processing` / `Finished`
  - non-creators and unauthenticated callers are rejected
  - `{"greeting": …}` deserializes to the `Greeting` variant, not `StartTime`
- E2E (`playwright/tests/web/space-waiting-greeting.spec.js`):
  - with an empty greeting, the waiting card shows no greeting
  - the admin writes the greeting in the settings panel and saves it
  - the candidate sees it above the waiting card heading
  - after start, the panel is read-only and the API returns 400
- E2E (`space-sampling-first-come.spec.js`): the Sampling card shows the greeting in the `Waiting` and `NotEligible` states.
