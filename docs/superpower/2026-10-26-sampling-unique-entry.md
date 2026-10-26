# Sampling: duplicate prevention through unique questions

Builds on `2026-10-16-sampling-entry-feedback.md`.

## Summary

The creator can mark short-answer questions of the entry poll (e.g. phone
number) as unique. Within one space's sampling, two members whose answer to
any marked question matches can never both be admitted, for both the first
come and the random method.

## What changes

- **Config** — `SpaceSamplingConfig.unique_questions` (jsonb list of entry
  poll question indices, versioned column v1, default `[]`). Only distinct
  `ShortAnswer` questions are accepted (`InvalidUniqueQuestion`); an empty
  list turns the feature off. `validate_ready` re-checks them before sampling
  starts (`ConfigOutdated`).
- **Member** — `SpaceSamplingMember.unique_keys` (jsonb list, versioned
  column v1). One key per answered unique question:
  `hex(sha256(space_id ":" index ":" normalized))`, where normalization
  trims, lowercases and removes all whitespace and `-`. Blank answers yield no
  key. Raw answers are never stored. Population members follow answer edits;
  `Selected` / `Entered` members are frozen, as before.
- **New table** `space_sampling_entry_keys` (`SpaceSamplingEntryKey`) with
  `UNIQUE(space_id, key_hash)`. A row is a key claimed by an admitted member.
  Cleared together with the other Sampling tables on uninstall and population
  rebuild.
- **First come** — the seat claim, the `Entered` transition and the key
  inserts share one transaction. A unique violation (SQLSTATE 23505) rolls
  everything back, including the seat, and returns `AlreadyEntered`. Keys are
  inserted in sorted order so concurrent claims cannot deadlock; the unique
  index makes a concurrent claimant wait and fail once the first commits.
- **Random** — instead of drawing per cell, the whole population is shuffled
  once and walked in order: a member is taken when their cell has a seat left
  and none of their keys is already taken (`selection::draw_unique`). Without
  keys each cell still gets a uniformly random subset. Drawn members' keys are
  inserted in the same transaction, so the draw ends with zero duplicates.
- **UI** — Sampling settings gain a "Duplicate prevention" section listing the
  entry poll's short-answer questions (`sampling-unique-question-{index}`).

## Migration

Additive only: two versioned jsonb columns with `'[]'::jsonb` defaults and
one new table, applied by the inventory schema runner at startup.

## Tests

- Unit: normalization, hashing, key building, validation, `draw_unique`
  (any-key overlap, cell capacity, keyless members unconstrained, fairness).
- Integration (`sampling_tests.rs`): validation, hashed keys following edits,
  first-come duplicate with seat restore, blank answers unrestricted,
  concurrent duplicates (one winner), random draw without duplicates, selected
  member entering with already-claimed keys.
- Playwright (`space-sampling-settings.spec.js`): pick a unique question,
  save and reload; the same phone number in another format cannot enter twice.

## Known limitation

The web poll editor authors free-text questions as `Subjective`, not
`ShortAnswer`, so unique questions can currently only be added through the
API / MCP poll update.
