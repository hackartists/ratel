# Sampling Entry Card — Feedback After Enter

**Author / Date**: Claude (subagent) · 2026-10-16
**Builds on**: `2026-10-15-space-greeting-editor-ux.md` (#1885), #1891

## Summary

After a population member presses Enter on the Sampling card, the card now shows a clear result instead of a one-line text swap: a congratulation banner when the seat is taken, or a closed-out banner when the group filled up first.

## What's changing

### UI (`SamplingEntryCard`)

- **Immediate state change**: `enterSampling` already returns the new `MySamplingStatusResponse`; the card writes it straight into the `getMySamplingStatus` query cache, so the result shows as soon as the request returns. The space context restart runs in the background afterwards instead of blocking the button. On failure the error toast shows and the status is refetched (e.g. `CellFull`).
- **Selected (`Entered`)**: a green check icon and "Congratulations! You were selected for the sample." (`축하합니다! 표본으로 선정되었습니다.`) replace the "Sample selection" heading; the message below reads "You can take part once the space starts." (`스페이스가 시작되면 참여할 수 있습니다.`). The card gets a green border/glow and the result pops in.
- **Greeting hidden once selected**: in the `Entered` state the admin greeting is not rendered and `data-has-greeting` is `false`, so the card returns to its normal size and the portal header shows again.
- **Closed out (`CellFull`, `NotSelected`)**: a muted cross icon with "First-come seats are all taken" (`선착순 모집이 마감되었습니다`) or "Not selected for the sample" (`표본으로 선정되지 않았습니다`) as the heading; the existing explanation stays below. The greeting stays visible.
- The result banner is a `role="status"` live region, so screen readers announce it.

### Stays the same

- The data model, API and `MySamplingState` values are unchanged; this is front-end only.
- Every other state keeps the "Sample selection" heading and the greeting.

## Test plan

- `space-sampling-first-come.spec.js`:
  - B5: the greeting shows before Enter; after Enter the selected banner, its heading and the new message show, and the greeting and the Enter button are gone;
  - B6: a member of a full group sees the closed banner with the first-come heading.
- `space-sampling-random.spec.js`: unchanged; entered / not-selected test ids are kept.
