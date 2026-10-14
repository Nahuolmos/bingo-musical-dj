# Archive Note — c-08-public-screen-delayed-3s

**Archived:** 2026-10-14 → `openspec/changes/archive/2026-10-14-c-08-public-screen-delayed-3s/`
**Schema:** spec-driven · **Tasks:** 12/12 · **Suite:** 141/141 green · **`openspec validate --specs`:** 8/8 clean
**Apply commit (already pushed):** `674777c feat-c08-apply` — archive made no code changes.

## What shipped

- `js/app.js`: `buildStateMessage(phase)` (spinning scrubs current/history/songs, keeps counters),
  `REVEAL_DELAY_MS=3000`, injectable buffer-timer seam
  (`schedulePublicReveal`/`cancelPublicReveal`/`isPublicBuffer`), phase-computing `broadcast()`
  overload, spin-end→buffer chain, guards in `handleDrawClick`/`setCurrentStatus`/`render`,
  dual cancel in clear/reset, id added to reveal current.
- `js/public.js` + `public.html` (regenerated from builder, zero drift): phase-keyed inline
  renderer (cabin message, SORTEANDO…, dedupe off `(phase,current.id)`), legacy no-phase
  inference, `requiresModernBrowser()`, `id="hint"` + Chrome/Edge upgrade copy.
- `tests/public.test.js` (new, 34 tests), `tests.html` (+C-08 mirror check),
  `docs/PRE_SHOW_CHECKLIST.md` (items 4b, 6b).
- Spec synced: `openspec/specs/public-screen/spec.md` (new capability, 6 requirements).
- No regressions in C-03/C-04/C-06/C-07.

## Known limitation

No Playwright runner in this zero-install repo → §4.1 of tasks done as portable two-harness
E2E (clock-mocked), not a real browser run. Live projector move remains a manual pre-show step
(checklist 4b). Real-browser `file://` smoke still pending for the C-11 drill (same note as C-07).

## Downstream contracts (for C-09 / C-10)

- **C-09 `confirm-void-reason`** is gated on buffer end via `isPublicBuffer()` — draw and
  played/void confirmation stay disabled through spin + public buffer.
- **C-10 `history-export-audit`** — one-row-per-draw preserved: delayed reveal adds no history
  entry; void motive (C-09) will ride on the single entry per draw.
