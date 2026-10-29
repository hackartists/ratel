# Analyze report deletion

Builds on `2026-10-23-analyze-reanalyze.md`.

## Summary

Creators can delete a saved analyze report from the list carousel and from
the report detail page. The report and everything derived from it are removed
in one transaction.

## What changes

- **API** `DELETE /api/spaces/{space_id}/apps/analyzes/reports/{report_id}`
  (`delete_analyze_report`, also an MCP tool). Creator only
  (`SpaceApp::can_edit`), same as create/get/reanalyze. Returns `"success"`.
- **Cleanup** in a single Postgres transaction:
  - `space_analyze_discussion_results` rows with the report's `report_id`
    (the discussion analysis history),
  - the 1:1 `space_analyze_report_results` row (poll/quiz/follow aggregates),
  - the `space_analyze_reports` row itself.
  `matched_records` live on the report row, so they go with it. The quota
  (`AnalyzeQuotaConfig`) is a count of live report rows, so deleting frees a
  slot; nothing to clean up there.
- **In-flight runs** deletion returns `SpaceAppError::AnalyzeReportDeleteWhileRunning`
  (409) while the report itself or any of its discussion analyses is
  `in_progress` and younger than `REANALYZE_STALE_AFTER_MS` (10 min). Reason:
  `auto_analysis` upserts the result row by `report_id` when it finishes, so
  deleting under it would recreate an orphaned result; `discussion_analysis`
  updates its row by id, so deleting under it makes the outbox retry a dead
  update until it is dead-lettered. Runs older than the stale window are
  treated as crashed (same rule as re-analysis) so a stuck report can still be
  removed.
- **Pipelines** defensive for the stale case: `auto_analysis` skips writing the
  result when the report row is gone, and `discussion_analysis` no longer fails
  (and retries) when the parent report is missing.
- **Web**
  - New shared `components/ui/confirm-popup.tsx` (`ConfirmPopup`, `primary` /
    `danger` tone, keeps buttons disabled while the confirm promise is pending).
  - `useDeleteAnalyzeReport(spaceId)` opens the danger confirm, calls the API,
    drops the report from the cached list, refetches the list and runs the
    caller's `onDeleted`.
  - List: trash icon button on the top-right of each saved report card
    (`report-delete-{id}`). Only the centred card is interactive.
  - Detail: `Delete` button on the right of the top bar (`report-delete-btn`);
    after deletion it replaces the URL with the list.
  - Carousel dot clicks resolve their index at click time so dots stay correct
    after a card disappears.
  - en/ko strings in `space-analyzes-app.i18n.tsx`, the new error in
    `enums.i18n.tsx`.

## What stays the same

Create / re-analyze / discussion analysis flows and their data model.

## Test plan

- Unit: `can_delete` matrix (settled, fresh report run, fresh discussion run,
  stale runs).
- E2E: `playwright/tests/web/analyze-delete.spec.js` — cancel sends no
  request; delete from the list removes the card and the API answers 404;
  delete from the detail page returns to the updated list.
