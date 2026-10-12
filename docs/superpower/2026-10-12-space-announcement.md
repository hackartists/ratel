# Space Announcement Action — System Design

**Roadmap**: Slack PO thread (Miner) — no `roadmap/*.md` spec; this doc is the record. The HTML-mockup stage is skipped: the feature reuses the existing quest card, participate card, post `Editor` and post body styles, so no new visual design is introduced.
**Author / Date**: Claude (subagent) · 2026-10-12

## Summary

A space can carry one announcement. It is shown to a logged-in user right after they press Participate and before the participate request is sent, and it stays reachable afterwards from an action card that is always pinned first. It is a new `SpaceActionType::Announcement` variant on the existing `space_actions` row, with no new table and no new struct. Its title and body are the row's `title` and `description`.

## Confirmed scope (PO)

1. One announcement per space, enforced on the server (create returns the existing one).
2. No reward.
3. No read/ack record.
4. Reopenable at any time after joining, from an action card.
5. Draft/publish and the "action started" notification follow the existing action behaviour (`Designing` → `Ongoing`). There is no special handling.
6. Progress: the announcement is excluded from the dashboard progress total, so it can never keep progress below 100%.
7. Target: logged-in users who press Participate. There is no unauthenticated path.
8. Authoring and display reuse the post `Editor` (`@/components/editor`) and the post detail body styles (`post-hero__body`).
9. Always first in the action list. Cannot be a required (prerequisite) action, and cannot be a dependency target.

## Data model

There is no new table, column or struct. The only change is one new label on the native Postgres enum:

```rust
pub enum SpaceActionType {
    Poll, TopicDiscussion, Follow, Quiz, Meet,
    #[cfg_attr(feature = "server", postgres(version = 1))]
    Announcement,
}
```

- `postgres(version = 1)`: an existing database gets `ALTER TYPE "space_action_type" ADD VALUE IF NOT EXISTS 'Announcement'` as a v1 migration. The v0 baseline (the five original labels) keeps its checksum, so already-deployed ledgers still validate.
- `to_behavior()` now returns `Option<RewardUserBehavior>`, and `Announcement` maps to `None`. Its only caller (`update_credits`) rejects `None` with `SpaceActionError::UnsupportedForAnnouncement`.
- Field reuse: `title` = announcement title, `description` = body HTML, `status` = draft/published gate. `credits`, `prerequisite`, `depends_on` and `required_attributes` stay at their defaults.

## API surface

- New: `POST /api/spaces/{space_pk}/announcements` → `create_space_announcement(space_pk) -> SpaceAction`. Creator only. Returns the existing announcement if the space already has one. The name avoids clashing with the sub-team `createAnnouncement` client.
- Read: `list_actions` (no dedicated get endpoint).
- Edit/delete: the existing `update_space_action` / `delete_space_action`.

### Server changes to existing paths

- `list_actions`: the "only prerequisites" retain keeps the announcement as well, so a user who has not finished the pre-survey still receives it. The status filter is unchanged, so a `Designing` announcement stays hidden from non-Creators. The result is then stably sorted with the announcement first.
- `update_space_action`: on an announcement, only `Status`, `Title`, `Description` and `Prerequisite { false }` are accepted. Anything else returns 400 `UnsupportedForAnnouncement`. A `Dependencies` update on any action that lists an announcement id returns 400 `InvalidDependency`.
- `delete_space_action`: an `Announcement` arm deletes only the companion row.
- Exhaustive matches (`aggregate_score`, `list_dashboard_data`, `list_my_home_spaces`, `space_fanout`) gain `Announcement` as a no-op. `has_completed_prerequisite_action` returns `true` for it as a defensive fallback.

## Frontend architecture

- `ParticipateCard`: if `ctx.actions` contains an announcement, pressing Participate first shows `AnnouncementNotice` (title + body + "Continue"). Continue then runs the existing join path (consent modal, or the participate request).
- `AnnouncementActionCard` (dashboard carousel): always `Active`, never archived, opens the announcement page. `ActionDashboard` excludes announcements from the progress `total`.
- `CandidateView`: Candidates (joined, waiting on the pre-survey) see no dashboard, so a single `prereq-item` row links to the announcement page.
- Page `/spaces/:spaceId/actions/announcements/:announcementId`:
  - The Creator gets a title input, the post `Editor` and `ActionStatusControl`. Saves go through `useUpdateSpaceAction`.
  - Everyone else gets the read-only `AnnouncementContent`.
- Creation: a new option in the dashboard `TypePickerModal`, plus `Announcement` cases in both `createSpaceAction` helpers.
- Exclusions: the announcement is excluded from `ActionDependencySelector` candidates and from `ActionSettingsModal`.
- i18n: strings live in the existing `space-viewer.i18n.tsx` bundle. Enum labels are added in `enums.i18n.tsx`.

## Test plan

- Server (`app/ratel/src/tests/announcement_action_tests.rs`):
  - singleton create
  - unauthenticated and non-Creator create rejected
  - announcement sorted first
  - Designing announcement hidden from, and Ongoing announcement shown to, a non-Creator who has not finished the prerequisites
  - credits / prerequisite / dependencies / required-attributes rejected
  - announcement as a dependency target rejected
  - title/description saved
- Playwright (`playwright/tests/web/space-scenario.spec.js` → "Space announcement"):
  - the Creator writes and publishes the announcement
  - a second create returns the same id
  - the card is first in the carousel
  - reward/prerequisite are rejected
  - a fresh member presses Participate, sees the announcement, continues, then reopens it from the card/link

## Open questions / risks

- XSS: neither the post viewer nor the action cards sanitize HTML. Posts and action descriptions are rendered raw today, and the announcement uses the same path. The difference is that it is seen by users who have not joined yet. Adding sanitization is a separate, cross-cutting decision.
- Singleton race: two concurrent creates could both insert. This is the same find-then-insert pattern as Follow, and a DB unique constraint would need a partial unique index.
- Notification: publishing an announcement fires the generic "action started" notification, as for every other action (PO decision 5).
