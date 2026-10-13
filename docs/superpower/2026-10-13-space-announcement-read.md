# Space Announcement — Read Completion (enhancement)

**Supersedes** decision 3 ("No read/ack record") and the "always `Active`, never archived" card rule in [`2026-10-12-space-announcement.md`](./2026-10-12-space-announcement.md). Everything else in that doc stands.
**Author / Date**: Claude (subagent) · 2026-10-13

## Summary

When a participant confirms the space announcement, the server records a per-user read. `list_actions` reports it as `user_participated`, the same flag that every other action type uses for completion. The Action Dashboard then moves the announcement from the active carousel into the archive panel, using the same `Completed` path as polls and quizzes.

## What "read" means

A read is recorded when the user presses the confirm button, not when the announcement is opened:

- **Join flow**: `AnnouncementNotice` → Continue. The read is recorded right after the participate request succeeds, on both the direct path and the consent-modal path, because the endpoint needs a joined role.
- **Announcement page**: `AnnouncementViewer` → Confirm, for a joined user (`Participant` / `Candidate`) who has not read it yet.

## What's changing

### Data model

New server-only Postgres entity `SpaceAnnouncementRead` (table `space_announcement_reads`). The table is created from the `PostgresEntity` inventory at startup, so no manual migration is needed.

| column | notes |
|--------|-------|
| `id` | UUID v7 surrogate PK |
| `user_pk` | reader `Partition` string (`USER#…`), indexed |
| `space_id` | indexed |
| `action_id` | announcement action id |
| `created_at` | first read time |

`(user_pk, space_id, action_id)` is unique, and writes use `upsert_on` on that key, so a repeated read is a no-op. The record is keyed on the real user pk, matching what `list_actions` uses for quiz attempts.

### API

- New: `POST /api/spaces/{space_pk}/announcements/{action_id}/read` → `read_space_announcement` → `ReadSpaceAnnouncementResponse {}`.
  - `Participant` / `Candidate` only. Viewers and unauthenticated callers get 401/403. The Creator is rejected, because it never reads the announcement through the participant view.
  - The action must be an `Announcement` in `Ongoing` / `Finish`. A draft or another action type returns `SpaceActionNotFound`.
- `list_actions`: a new `Announcement` arm sets `user_participated` from `SpaceAnnouncementRead::exists`.

### Frontend

- `deriveActionStatus`: `Announcement` → `Completed` when `user_participated`, otherwise `Active`. It is never `Skipped`.
- `ActionDashboard`:
  - The progress `done` count still excludes announcements, so `done / total` stays consistent.
  - The archive badge counts every archived row.
  - An archived announcement row opens the announcement page.
- `ParticipateCard` / `ConsentModal`: record the read after a successful participate, if the announcement step was shown.
- `AnnouncementViewer`: Confirm records the read, refreshes the actions and returns to the space home. If the request fails, it shows a toast and stays on the page.
- `useReadSpaceAnnouncement` hook (hand-maintained), plus the generated handler and types.

### Unchanged

- The announcement still can't carry a reward, can't be a prerequisite and can't be a dependency target.
- `CandidateView` still links to the announcement whether or not it has been read.

## Test plan

- Server (`announcement_action_tests.rs`):
  - a read flips `user_participated` for the reader only
  - a repeated read is idempotent
  - unauthenticated, viewer, Creator, draft and non-announcement reads are rejected
- Playwright (`space-scenario.spec.js` → "Space announcement"):
  - after Continue, `list_actions` reports the announcement as read
  - once the space starts, the member's carousel has no announcement card, and the archive panel lists it as completed and reopens it
