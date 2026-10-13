# Space Announcement — Read Completion (enhancement)

**Supersedes** decision 3 ("No read/ack record") and the "always `Active`, never archived" card rule in [`2026-10-12-space-announcement.md`](./2026-10-12-space-announcement.md). Everything else in that doc stands.
**Author / Date**: Claude (subagent) · 2026-10-13

## Summary

When a participant confirms the space announcement, the server records a per-user read. `list_actions` reports it as `user_participated`, the same flag that every other action type uses for completion. The Action Dashboard then moves the announcement from the active carousel into the archive panel, using the same `Completed` path as polls and quizzes.

## What "read" means

A read is recorded when the user presses the confirm button, not when the announcement is opened:

- **Join flow**: `AnnouncementNotice` → Continue. The read is recorded right after the participate request succeeds, on both the direct path and the consent-modal path, because the endpoint needs a joined role.
- **Announcement page** (opened from the dashboard): `AnnouncementViewer` renders the same `AnnouncementNotice` card as the join flow; Continue records the read when the server role (`ctx.role`, not the view toggle) is `Creator`, `Participant` or `Candidate` and it has not been read yet. Users who missed the join-time step get it recorded here.

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
  - `Creator` / `Participant` / `Candidate`. Viewers and unauthenticated callers get 401/403.
  - **Revised 2026-10-13**: the original decision "Creator never records a read" is dropped. Once a space is `Ongoing`, `SpaceContext` shows the Creator the participant view, so the Creator does read the announcement there; rejecting the read left the card stuck in the active carousel and the button failed with `NoPermission`.
  - The action must be an `Announcement` in `Ongoing` / `Finish`. A draft or another action type returns `SpaceActionNotFound`.
- `list_actions`: a new `Announcement` arm sets `user_participated` from `SpaceAnnouncementRead::exists`.

### Frontend

- `deriveActionStatus(action, adminView)`: `Announcement` → `Completed` when `user_participated`, otherwise `Active`. It is never `Skipped`. In the admin view (`currentRole === "Creator"`) it is always `Active`, so the creator can still edit it from the carousel after reading it; only the participant view archives it.
- `ActionDashboard`:
  - The progress `done` count still excludes announcements, so `done / total` stays consistent.
  - The archive badge counts every archived row.
  - An archived announcement row opens the announcement page.
- `ParticipateCard` / `ConsentModal`: record the read after a successful participate, if the announcement step was shown.
- `AnnouncementViewer`: Continue records the read, refreshes the actions and returns to the space home. Already read or not joined → it just navigates back. If the request fails, it shows a toast and stays on the page; the button is disabled while in flight.
- `useReadSpaceAnnouncement` hook (hand-maintained), plus the generated handler and types.

### Unchanged

- The announcement still can't carry a reward, can't be a prerequisite and can't be a dependency target.
- `CandidateView` still links to the announcement whether or not it has been read.

## Test plan

- Server (`announcement_action_tests.rs`):
  - a read flips `user_participated` for the reader only
  - a repeated read is idempotent
  - a Creator read succeeds and flips `user_participated` for the Creator only
  - unauthenticated, viewer, draft (also for the Creator) and non-announcement reads are rejected
- Playwright (`space-scenario.spec.js` → "Space announcement"):
  - after Continue, `list_actions` reports the announcement as read
  - once the space starts, the member's carousel has no announcement card, and the archive panel lists it as completed and reopens it
  - a member who joined without reading opens it from the dashboard, presses Continue, and it moves to the archive
