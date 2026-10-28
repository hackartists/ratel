# Sampling: privacy-consent questions as unique questions

Builds on `2026-10-26-sampling-unique-entry.md`.

## Summary

The duplicate-prevention setting also accepts the entry poll's
privacy-consent (개인정보 동의) questions. Such a question is keyed by the
respondent's SMS-verified phone, so one phone number can be admitted once.

## What changes

- **Validation** — `validate_unique_questions` accepts distinct
  `ShortAnswer` or `PrivacyConsent` questions; every other type and
  duplicates still fail with `InvalidUniqueQuestion` (copy updated).
- **Keys** — `unique_keys_for` keys an `Answer::PrivacyConsent` with
  `agreed: true` and `Some(phone)` as
  `unique_key_hash(space_id, index, normalize_unique_phone(phone))`. A
  declined consent or a consent without a phone yields no key, like a blank
  short answer.
- **Phone normalization** — the stored phone is whatever the client sent and
  passed SMS verification. The web `PhoneInput` sends E.164
  (`+821012345678`), but phones linked through older clients or direct API
  calls may be domestic (`010-1234-5678`). `normalize_unique_phone` applies
  `normalize_unique_answer`, drops `(`, `)` and `.`, and folds `+82` into the
  domestic trunk prefix `0` (`+82 10…`, `+82 010…` and `010…` all become
  `010…`). Other country codes keep their E.164 form.
- **UI** — the settings list shows privacy-consent questions next to
  short-answer ones. The empty state (`sampling-no-unique-question`, was
  `sampling-no-short-answer`) only shows when neither exists.

## What stays the same

Data model, key storage, first come / random enforcement and the hash
scope (space + question index) are unchanged. No migration.

## Tests

- Unit: `unique_keys.rs` — phone normalization variants, agreed consent
  keyed by phone, declined/phoneless consent yields no key, mixed short
  answer + consent keys, validation accepts consent questions.
- Integration: `test_privacy_consent_phone_prevents_duplicate_entry`.
- Playwright: `space-sampling-settings.spec.js` A4d (pick and persist the
  consent question) and A6c (same verified phone in another format cannot
  enter).
