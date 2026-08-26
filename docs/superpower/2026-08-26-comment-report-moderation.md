# Comment Report & Moderation — System Design

**Context**: Apple App Store **Guideline 1.2 (Safety — User-Generated Content)** rejection.
The iOS app is built from `main`/prod, which is still **DynamoDB** (not the Postgres `dev`).
This feature is implemented on `main` with **DynamoEntity** patterns.

**Author / Date**: Claude · 2026-08-26
**Branch**: `feature/comment-report-moderation` (off `main`)

## Apple's 5 requirements → how each is satisfied

| # | Requirement | Implementation | In review recording |
|---|---|---|---|
| 1 | EULA agreed before signup, zero-tolerance wording | EXISTS: signup modal `agreed_tos` gate + `views/terms`. **Strengthen** wording (no tolerance for objectionable content/abusive users; violators ejected within 24h). | ✅ |
| 2 | Filter objectionable content | Report accumulation → **auto-hide** the comment at a configurable threshold + admin moderation queue. | — |
| 3 | Flag objectionable content | **Report** action on each discussion comment (reason + optional detail). | ✅ |
| 4 | Block abusive users | **Personal block**: a viewer blocks a comment's author → that author's comments vanish from the viewer's feed instantly + admin is notified. | ✅ |
| 5 | Act on reports within 24h | **Admin moderation page**: review flagged users + reported comments → **Block (soft-ban)** / Dismiss. Soft-ban = existing comments hidden + new comments/replies rejected. | — |

## Flow

```
User reports a comment (reason)
  → SpacePostCommentReport created (deduped per reporter)
  → comment.report_count++ ; author tally++
  → if comment.report_count >= threshold  → comment.hidden = true   (auto-hide, req #2)
  → if author tally        >= threshold   → UserModerationFlag = PendingReview (admin queue, req #5)

Admin opens moderation page
  → sees flagged users + their reported/hidden comments
  → [Block]  → UserModerationFlag = Blocked (soft-ban)   → author's comments hidden + posting rejected
  → [Dismiss]→ UserModerationFlag = Dismissed            → auto-hidden comments restored

Viewer blocks an author (personal, req #4)
  → UserBlock { blocker, blocked } created
  → list_comments/list_replies exclude blocked authors for that viewer
  → admin notified (moderation inbox)
```

Threshold is **admin-configurable** (stored in `ModerationSetting`, default 3).

## Data model (DynamoDB · DynamoEntity)

### Changed: `SpacePostComment`
Add two fields (server-filtered, default false/0 so existing rows deserialize):
- `hidden: bool` — auto-hidden or admin-hidden; excluded from listings.
- `report_count: u64` — distinct reporters of this comment.

### New: `SpacePostCommentReport`
One row per (comment, reporter) — dedupes double-reports and lets us count distinct reporters.
- `pk` = the comment's post `Partition`; `sk` = `SPACE_POST_COMMENT_REPORT#<comment_id>#<reporter_id>`.
- fields: `comment_sk`, `author_pk` (reported author), `reporter_pk`, `reason` (enum), `detail`, `created_at`.

### New: `UserModerationFlag`
Per-user moderation state, drives the admin queue and the soft-ban.
- `pk` = `USER_MODERATION`; `sk` = `<user_id>`.
- `report_count: u64`, `status` (`None|PendingReview|Blocked|Dismissed`), `updated_at`.
- GSI on `status` → admin queue lists `PendingReview` (and `Blocked`).

### New: `UserBlock` (personal block, req #4)
- `pk` = `USER_BLOCK#<blocker_id>`; `sk` = `<blocked_id>`.
- query by pk → the viewer's block set (applied in comment listings).

### New: `ModerationSetting`
- singleton `pk = MODERATION_SETTING`, `sk = GLOBAL`, `report_threshold: u64` (default 3).

## API surface (controllers)

Discussion (`.../discussion/controllers/`):
- `POST /api/spaces/{space_id}/discussions/{discussion_id}/comments/{comment_id}/report` — create report (auth: SpaceUser). Body: `{ reason, detail? }`.
- `POST /api/users/{user_id}/block` · `DELETE …/block` — personal block/unblock (auth: User).
- **Modify** `add_comment`, `reply_comment`, `update_comment` → reject if author is soft-banned (`UserModerationFlag = Blocked`).
- **Modify** `list_comments`, `list_replies` → drop `hidden` comments and comments whose author the viewer personally blocked.

Admin (`features/admin/controllers/moderation/`):
- `GET /api/admin/moderation/flags?status=` — flagged-user queue.
- `GET /api/admin/moderation/reports?user_id=` — reports/comments for a user.
- `POST /api/admin/moderation/users/{user_id}/block` · `/dismiss` — soft-ban / dismiss.
- `GET`/`PATCH /api/admin/moderation/setting` — read/update threshold.

All error paths log server-side and return typed unit errors (no internal detail leak).

## Frontend (Dioxus RSX)

- **Report + personal block**: comment overflow (⋯) menu on the discussion comment component → `ReportCommentDialog` (reason radio + optional detail) and a "Block this user" item. Wired through the discussion controller hook (`UseDiscussionArena` or a `use_moderation` action) — never the `_handler` directly.
- **Terms**: strengthen `views/terms` wording; keep the signup `agreed_tos` gate.
- **Admin moderation page** (`features/admin/.../moderation`): list flagged users, each with reported comments + reporter count → `[Block]` / `[Dismiss]`; a threshold setting field.
- All strings via `translate!` (EN + KO). Semantic tokens + primitive components only.

## Developer notification (req #4)

Personal block and threshold-triggered flags surface in the **admin moderation queue** (the developer's review surface). Reuse the existing notification/inbox path where practical; the queue itself is the durable "notify developer" mechanism.

## Test plan

- Server-function integration tests (`tests/`): report create + dedup; threshold → auto-hide; admin block → soft-ban rejects add_comment; personal block filters listings; unauth/forbidden cases.
- Playwright (records the 3 review-visible flows): terms gate before signup, report a comment, block a user.

## Open questions / deferred

- Developer-notification channel (email/Slack) beyond the in-app admin queue — deferred; queue satisfies the requirement.
- Reporting on other UGC surfaces (posts, non-discussion comments) — out of scope for this pass (discussion comments only, per request).
