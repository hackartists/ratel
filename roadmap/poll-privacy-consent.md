# Poll Privacy-Consent Question

## Problem
Some polls need to collect a respondent's phone number (e.g. for prize draws,
follow-up contact, or identity binding) under a legally defensible consent
flow. Today's poll question types (single/multiple choice, short answer,
subjective, checkbox, dropdown, linear scale) have no way to show consent
terms and collect a verified phone number as part of answering a poll.

## Goal
A poll designer can add a "privacy consent" question type that shows
custom consent terms (written in the existing rich-text editor) and
requires the respondent to agree and verify a phone number via SMS code
before the poll can be submitted.

## Non-goals
- No per-question toggle to turn phone collection on/off — this version
  always collects a phone number when this question type is used.
- No configurable consent purposes/categories — a single terms block.
- No retention/deletion policy UI — storage behavior matches how other
  poll answers are stored today (plaintext in `SpacePollUserAnswer`).
- No change to the canister/ABE-encrypted vote path's handling of phone
  numbers — only the plaintext Postgres/Dynamo answer record carries it.

## User stories
- As a space designer, I want to add a privacy-consent question to a poll,
  writing the consent terms in the same rich-text editor used elsewhere,
  so that I can legally collect a respondent's phone number.
- As a participant, I want to read the consent terms and agree before
  giving my phone number, so that I understand what I'm consenting to.
- As a participant who is already logged in with a verified phone number,
  I want that number pre-filled, so that I don't have to re-enter and
  re-verify it every time.
- As a participant, I want a "change" action to enter a different phone
  number and re-verify it via SMS code, so that I can use a number other
  than my account's.

## Functional requirements
1. The system SHALL support a new poll question type, `privacy_consent`,
   alongside the existing seven types.
2. A `privacy_consent` question SHALL store: title, optional description,
   consent terms title, and consent terms body (rich text, authored via
   the existing editor component — same storage shape as other rich-text
   content in the app, e.g. HTML string).
3. When rendering a poll for response, the system SHALL show the consent
   terms to the participant and require an explicit agreement action
   before the phone field is enabled.
4. If the logged-in user has a verified phone number on file
   (`UserPhoneNumber`), the system SHALL pre-fill it as the default answer
   phone number.
5. The participant SHALL be able to press a "change" control to enter a
   different phone number, request a verification code, and verify it
   via the existing phone verification flow (same codepath as
   `verify_phone_code_handler` / `PhoneVerification`).
6. On poll submission, the server SHALL re-verify the submitted phone
   number + code against the stored `PhoneVerification` record (not trust
   a client-asserted "verified" flag) before accepting the answer.
7. The system SHALL reject submission of a `privacy_consent` answer when
   agreement is false, or when the phone number is missing/unverified AND
   the question `is_required`.
8. The submitted phone number SHALL be stored in the answer record
   (`SpacePollUserAnswer`) in the same plaintext manner as other poll
   answer payloads today.

## Acceptance criteria
- [ ] Space designer can add a `privacy_consent` question to a poll and
      author consent terms in the rich-text editor.
- [ ] Participant sees terms, must check/confirm agreement before the
      phone field activates.
- [ ] Logged-in participant with a verified phone sees it pre-filled.
- [ ] Participant can click "change", enter a new number, receive and
      enter a verification code, and have it accepted.
- [ ] Submitting without agreement, or with an unverified/incorrect code,
      is rejected by the server (not just the client).
- [ ] Poll results/answer export includes the collected phone number.

## Constraints
- Privacy/compliance: consent terms text and the fact of agreement must
  be retrievable later (same durability as other poll answers).
- Reuses existing SMS verification infrastructure (AWS SNS /
  `PhoneVerification`) — no new SMS provider.
- Phone numbers are stored in plaintext in the answer record (confirmed
  acceptable by Miner for v1 — revisit if compliance requirements change).

## Open questions
None blocking Stage 2. Future: should phone collection become optional
per-question (toggle)? Revisit only if a concrete need arises.

## References
- `app/ratel/src/features/spaces/pages/actions/actions/poll/types/question.rs`
- `app/ratel/src/features/spaces/pages/actions/actions/poll/types/answer.rs`
- `app/ratel/src/features/auth/controllers/verify_code.rs`
- `app/ratel/src/features/auth/models/user_phone_number.rs`
