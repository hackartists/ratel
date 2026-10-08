# Discussion Required Attributes — System Design

**Roadmap**: Slack PO/design thread (Miner) — no `roadmap/*.md` spec file; this doc is the record of record. The HTML-mockup stage (Stage 2 of the normal workflow) is skipped because the feature reuses `ActionDependencySelector`'s existing chip-based UI pattern verbatim — no new visual design is introduced.
**Author / Date**: Claude (subagent) · 2026-10-08

## Summary

Adds a second, independent gate to Discussion (and by extension any space action going through the shared `can_execute_space_action` gate) participation: "Required Attributes". Each rule pins a Poll action's single-choice question to a set of allowed answer values; a participant satisfies the rule when their recorded answer equals one of those values (OR within a rule). Multiple rules AND together, and the whole set is independent of (AND-combined with) the existing `depends_on` (Dependency Actions) gate.

## Data model

Postgres (`space_actions` table, jsonb column — no migration file needed; the ORM applies `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on boot):

```rust
pub struct RequiredAttributeRule {
    pub poll_action_id: String,   // SpaceAction.action_id of a Poll action in the same space
    pub question_index: usize,    // position in that poll's `questions` Vec<Question> (no stable per-question id exists)
    pub allowed_values: Vec<String>, // option label strings; OR within the rule
}

#[serde(transparent)]
pub struct SpaceActionRequiredAttributes(pub Vec<RequiredAttributeRule>); // jsonb, embedded in SpaceAction
```

`SpaceAction.required_attributes: SpaceActionRequiredAttributes` (new field, `#[serde(default)]`), bridged through `SpaceActionWire` the same way `depends_on` is. `SpaceActionSummary` carries `required_attributes: Vec<RequiredAttributeRule>` + `required_attributes_met: bool` for the list/card UI, computed per-viewer in `list_actions`.

`question_index` rather than a question id: `Question` (poll/types/question.rs) carries no stable identifier today — introducing one was weighed and rejected as scope creep for this change (editing a poll's question order after a rule references it would silently retarget the rule either way; same risk profile as index-based diffing elsewhere in the poll editor).

## API surface

- `POST /api/spaces/{space_id}/actions/{action_id}` (`update_space_action`) — new `UpdateSpaceActionRequest::RequiredAttributes { required_attributes: Vec<RequiredAttributeRule> }` variant, same shape as `Dependencies`.
- `GET /api/spaces/{space_pk}/actions` (`list_actions`) — populates `required_attributes_met` per action for the current viewer (false for anonymous/un-answered).
- No new read endpoint for poll questions — the frontend reuses `getPoll` per candidate Poll action.

## Access control

`access.rs::can_execute_space_action` gained a `required_attributes_met: bool` parameter, ANDed into the final `role_ok && status_ok && dependencies_met && required_attributes_met`. New `services/required_attributes.rs::required_attributes_met()` mirrors `services/dependency.rs::dependencies_met()`: empty rule list → `true`; otherwise every rule must resolve the user's `SpacePollUserAnswer` for that poll, index into `answers[question_index]`, require it to be `Answer::SingleChoice { answer: Some(idx), .. }`, resolve `idx` against the poll's own `questions[question_index]` (must itself be `Question::SingleChoice`) to get the chosen option's label, and check that label is in `allowed_values`. Any missing poll/answer/question/non-matching-type short-circuits to `false` — an unanswered poll fails the same way an incomplete dependency does.

Called from every controller that already calls `dependencies_met` (`respond_poll`, `respond_quiz`, `add_comment`, `reply_comment`, `update_comment`, `delete_comment`) — same call sites, same AND composition, no new gate surface.

## Frontend architecture

- `ActionRequiredAttributeSelector` (`apps/web/src/components/space-actions/action-required-attribute-selector.tsx`) — same chip + popover pattern as `ActionDependencySelector`, one level deeper: lists every Poll action in the space (`useSpaceActionList`), fetches each via `useQueries` + `getPoll`, filters questions to `answer_type === "single_choice"`, and on selection prompts for one-or-more allowed option values before saving via `useUpdateSpaceAction`.
- `DiscussionConfigCard` renders it in a new `section-required-attributes` section, directly below `section-dependencies`.
- `ActionCard` surfaces a lock reason distinguishing "complete dependency actions" vs "answer the required poll question" (both still fall back to the server's generic `NotAvailableInCurrentStatus` error toast when a locked card is actually clicked through, same as `depends_on` today — no redirect to the referenced poll per the confirmed scope).

## Test plan

- `cargo test` (server feature): existing `shipped_client_compat_tests` cover the wire bridging for `SpaceAction`/`SpaceActionSummary` unaffected by the new field (both tests re-run clean).
- Playwright:
  - `arena-action-editor.spec.js` — Discussion ConfigCard shows the Required Attributes section; adding a Poll with mixed question types shows only the single-choice one as a candidate; a saved rule renders as a chip.
  - `space-scenario.spec.js` — full flow: unanswered poll blocks Discussion participation; answering with a disallowed option still blocks; answering with an allowed option (one of several) unlocks; Dependency Actions + Required Attributes both configured requires both to be satisfied (AND).

## Open questions / risks

- `question_index` stability: fine for this scope: Required Attribute rules are configured by the same space Creator who edits the poll, and poll question reordering after publishing is already a known soft spot shared with dependency-free analytics code. Flagged here for whoever eventually adds stable question ids.
