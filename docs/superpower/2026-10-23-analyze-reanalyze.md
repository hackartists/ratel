# Analyze report re-analysis

## Summary

Saved analyze reports are computed once, when the report is created, and the
poll/quiz/follow aggregates are persisted on `SpaceAnalyzeReportResult`. The
detail page therefore never reflects responses submitted later. This change
adds a **Re-analyze / 재분석** action next to **Download Excel** that re-runs the
existing pipeline against the space's current data.

## How results are produced today

| Surface | Computation | Persisted? |
|---|---|---|
| Report detail – poll / quiz / follow panels | `auto_analysis::process_analyze_report`, fired by the `AnalyzeReportInProgress` outbox rule on report INSERT | Yes – `SpaceAnalyzeReportResult` (unique `report_id`), report `status = finish` |
| Report detail – discussion panel | `discussion_analysis`, one `SpaceAnalyzeDiscussionResult` row per user-triggered run | Yes, as a history; already re-runnable from the panel |
| Report records page | `matched_records` frozen on the report row at create time | Yes |
| `analyzes/poll/:pollId` page | `get_poll_result` | No – computed live on every read |

## What changes

- **API** `POST /api/spaces/{space_id}/apps/analyzes/reports/{report_id}/reanalyze`
  (`reanalyze_analyze_report`, also an MCP tool). Creator only (`SpaceApp::can_edit`),
  same as create/get. Re-captures `matched_records` from the saved filters, sets
  `status = in_progress`, and emits a `MODIFY` outbox event on the
  `SPACE_ANALYZE_REPORT` topic in the same transaction.
- **Dispatcher** `AnalyzeReportInProgress` now matches INSERT **or** MODIFY with
  `status = in_progress`. The pipeline's own `finish` / `failed` writes emit no
  event, so they never re-trigger.
- **Pipeline** the result row is upserted on `report_id` (was a plain insert,
  which would hit the unique constraint on a second run), and any pipeline error
  flips the report to `failed` so the UI stops waiting.
- **Guard** a report already `in_progress` returns
  `SpaceAppError::AnalyzeReportAlreadyRunning` (409) unless the run is older
  than 10 minutes (stuck / dead-lettered), which may be retried.
- **Quota** re-analysis reuses the existing report row, so it does not consume
  the per-space report quota (`AnalyzeQuotaConfig`); the quota limits how many
  reports exist, not how often one is refreshed.
- **Web** report detail: Re-analyze button in the poll (next to Download Excel),
  quiz and follow panel toolbars, confirm popup (results are replaced), disabled
  + spinning while running, detail query polls every 3 s while `in_progress` and
  toasts on finish/failure. The live `analyzes/poll/:pollId` page gets the same
  button, which simply re-fetches (no confirm, nothing is overwritten).

## What stays the same

Report filters, discussion analysis history, and the create flow/quota.

## Test plan

- Unit: `can_reanalyze` status/staleness matrix; dispatcher rule matches
  re-analysis MODIFY and ignores `finish` MODIFY.
- E2E: `playwright/tests/web/analyze-reanalyze.spec.js` – create report, wait for
  `finish`, click Re-analyze → confirm → POST returns `in_progress` → report
  returns to `finish`; cancel path sends no request.
