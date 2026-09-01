# Phase 5 — Rule → outbox-emit wiring map

Companion to `2026-08-07-phase5-events-decommission.md`. The complete list of the
35 dispatcher rules, each with the entity it deserializes, the `topic` token it
matches on, the emit kind, and the mutation site to wire
`EventOutbox::emit_*(topic::…, …)` into. `dispatcher.rs` (handlers) stays unchanged.

Status legend: ✅ wired · ☐ pending · ⤵ likely already inline (verify before wiring)

| # | Rule | Entity | topic token | emit | mutation site | status |
|---|------|--------|-------------|------|---------------|--------|
| 1 | SpaceStatusChangeEvent | SpaceStatusChangeEvent | `SPACE_STATUS_CHANGE_EVENT#` | insert | `spaces/space_common/controllers/update_space.rs` | ✅ |
| 2 | ActivityScoreAggregate | SpaceActivity | `SPACE_ACTIVITY#` | insert | `activity/controllers/record_activity.rs:83` | ☐ |
| 3 | PollXpRecord | SpacePollUserAnswer | `SPACE_POLL_USER_ANSWER#` | insert | `…/poll/controllers/respond_poll.rs:263` | ☐ |
| 4 | QuizXpRecord | SpaceQuizAttempt | `SPACE_QUIZ_ATTEMPT#` | insert | `…/quiz/controllers/respond_quiz.rs:81` | ☐ |
| 5 | DiscussionXpRecord | SpacePostComment | `SPACE_POST_COMMENT#` | insert | `…/discussion/controllers/comments/add_comment.rs` | ☐ |
| 6 | FollowXpRecord | UserFollow | `FOLLOWER#` | insert | `my_follower/controllers/follow_user.rs`, `…/follow/controllers/follow_user.rs` | ☐ |
| 7 | NotificationSend | Notification | `NOTIFICATION#` | insert | notification create sites | ⤵ |
| 8 | InboxPushFanout | UserInboxNotification | `USER_INBOX_NOTIFICATION#` | insert | inbox-notification create sites | ⤵ |
| 9 | PostVectorIndex | Post | `POST` (starts) | insert/modify | post create/publish | ☐ |
| 10 | PostVectorDelete | Post (old) | `POST` | remove | post delete | ☐ |
| 11 | EssenceIndexPost | Post | `POST` (exact) | upsert | post upsert | ☐ |
| 12 | EssenceDeletePost | Post (old) | `POST` (exact) | remove | post delete | ☐ |
| 13 | PopularPostUpdate | Post | `POST` | modify | post modify (counts) | ☐ |
| 14 | PostPublishedForSyndication | Post | `POST` | modify (status=PUBLISHED) | post publish | ☐ |
| 15 | PopularSpaceUpdate | SpaceCommon | `SPACE_COMMON` | modify (participants) | space update | ☐ |
| 16 | SpacePublished | SpaceCommon | `SPACE_COMMON` | modify (status) | space publish | ☐ |
| 17 | SpaceActionStatusChange | SpaceAction | `SPACE_ACTION` | modify (Designing→Ongoing) | action status change | ☐ |
| 18 | EssenceActionMetadataUpdate | SpaceAction | `SPACE_ACTION` | upsert | action upsert | ☐ |
| 19 | AiModeratorReplyCheck | SpacePost | `SPACE_POST#` | insert | space-post (discussion) create | ☐ |
| 20 | AiModeratorReplyIndex | SpacePostComment | `SPACE_POST_COMMENT#` | insert | discussion comment create | ☐ |
| 21 | EssenceIndexDiscussionComment | SpacePostComment | `SPACE_POST_COMMENT#` | upsert | discussion comment upsert | ☐ |
| 22 | EssenceDeleteDiscussionComment | SpacePostComment (old) | `SPACE_POST_COMMENT#` | remove | discussion comment delete | ☐ |
| 23 | EssenceIndexPostComment | PostComment | `POST_COMMENT#` | upsert | post comment upsert | ☐ |
| 24 | EssenceDeletePostComment | PostComment (old) | `POST_COMMENT#` | remove | post comment delete | ☐ |
| 25 | EssenceIndexPoll | SpacePoll | `SPACE_POLL#` | upsert | poll create/update | ☐ |
| 26 | EssenceDeletePoll | SpacePoll (old) | `SPACE_POLL#` | remove | poll delete | ☐ |
| 27 | EssenceIndexQuiz | SpaceQuiz | `SPACE_QUIZ#` | upsert | quiz create/update | ☐ |
| 28 | EssenceDeleteQuiz | SpaceQuiz (old) | `SPACE_QUIZ#` | remove | quiz delete | ☐ |
| 29 | CharacterXpDelta | SpaceScore | `SPACE_SCORE` | upsert | space-score upsert | ☐ |
| 30 | SubTeamAnnouncementPublished | SubTeamAnnouncement | `SUB_TEAM_ANNOUNCEMENT#` | insert/modify | announcement publish | ☐ |
| 31 | AnalyzeReportInProgress | SpaceAnalyzeReport | `SPACE_ANALYZE_REPORT#` | insert/modify | analyze report create | ☐ |
| 32 | AnalyzeDiscussionInProgress | SpaceAnalyzeDiscussionResult | `SPACE_ANALYZE_DISCUSSION_RESULT#` | insert | `…/analyzes/controllers/analyze_discussion.rs:76` | ☐ |
| 33 | SyndicationJobReady | SyndicationJob | `SYNDICATION_JOB#` | insert/modify | syndication job ready | ☐ |
| 34 | FactFoldChat | FactFoldChat | `FACT_FOLD_CHAT#` | insert | fact-fold chat insert | ☐ |
| 35 | TimelineUpdate | (see filter) | — | — | verify filter/entity before wiring | ☐ |

## Notes for the wiring pass

- **`upsert`** in the dispatcher = `is_insert(e) || is_modify(e)`. Emit `emit_insert`
  on create and `emit_modify` on update (or `emit_insert` for both if the handler is
  idempotent and doesn't read `old_image`).
- **MODIFY rules with field conditions** (e.g. #14 `status=PUBLISHED`, #17
  Designing→Ongoing): the field lives in the entity image, so `emit_modify(topic, &old,
  &new)` suffices — the dispatcher filter re-checks the condition. Only emit when the
  transition actually occurs to avoid firing the handler on unrelated updates.
- **⤵ already-inline candidates** (#7, #8): Phase 1 moved mention/subscriber
  notifications inline (`add_comment.rs`). Confirm each notification path is inline (no
  emit needed) vs. still CDC-only (needs emit) before wiring — do not double-fire.
- Every entity's `topic` constant goes in `common/events/outbox.rs::topic`.
- Verify each wired rule against its `*_tests.rs`; add coverage where missing.
