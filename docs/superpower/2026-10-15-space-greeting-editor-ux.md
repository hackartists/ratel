# Space Waiting Greeting — Editor and Waiting Card UX

**Author / Date**: Claude (subagent) · 2026-10-15
**Builds on**: `2026-10-14-space-waiting-greeting.md` (#1883)

## Summary

The greeting editor moves out of the narrow settings panel into its own page, and the waiting card gives the greeting the space of its icon and heading.

## What's changing

### UI

- **Settings panel**: the inline `GreetingSection` editor is removed. Admins see a "Greeting settings" (`인사말 설정`) row instead, styled like the app rows. Its button reads "Edit", or "View" once the space has started. It opens `/spaces/:spaceId/settings/greeting`.
- **Greeting settings page** (`pages/spaces/[spaceId]/settings/greeting/page.tsx`): a full-page route under `space-layout`. It uses the General app's arena chrome (`space-general-arena` / `sga-*`): a topbar with a back button and breadcrumb, the standard 1100px body with a tall RichText editor, and a sticky footer holding the save status and the Save button. Once the space has started, the page shows a lock notice and a read-only editor with no Save button. Non-creators see a no-access message.
- **WaitingCard**: when the greeting is set, it renders in place of the check icon and the "You're all set" heading. When the greeting is empty, the card is unchanged. The participants count moves from above the prerequisite list to the bottom row, beside the "Waiting for space to start" status pill. The card widens from 380px to 440px, and the status pill's letter-spacing and padding tighten slightly, so the two pills fit on one row.
- **SamplingEntryCard**: unchanged. It still shows the greeting above its heading.

### Stays the same

- The data model, API and lock rule are unchanged: the page still saves through `PATCH /api/spaces/{id}` with `{ greeting }`, which is rejected once the space is `Ongoing`, `Processing` or `Finished`.
- `isGreetingEditable` moves to `components/space/space-context.tsx`, so the panel entry and the page share it.

## Design choice: page, not modal

The space settings entries that need room (General, Sampling, Panels, Analyzes) all navigate to dedicated pages that share the same arena chrome. A route also gives the editor the full viewport, a working browser back button and a deep link, so the greeting editor follows the same pattern.

## Test plan

- `space-waiting-greeting.spec.js`:
  - the panel shows the entry, and no inline editor;
  - the entry opens the page, where the editor is at least 640×320;
  - saving updates the status pill and the API;
  - the waiting card shows its icon and heading while the greeting is empty, and hides them once a greeting is set;
  - the participants pill sits on the same row as the status pill;
  - once the space has started, the page is read-only.
- `space-sampling-first-come.spec.js`: the existing greeting checks on the Sampling card still pass.
