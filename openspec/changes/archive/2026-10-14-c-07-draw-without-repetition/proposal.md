# Proposal

## Why

C-03 left a secure engine with no game rule on top, and C-04 left a `locked` guard with nothing ever activating it (smoke point 5 FAIL pre-C-07 by design). Without C-07 the DJ can re-draw the same song, mutate the list mid-show, and import after the first draw — breaking RN-SOR-01 fairness and RN-SES-01 list-freeze. C-07 closes both gaps in one CRITICO change before C-08/C-09 build the live show on it.

## What Changes

- Handler `Sortear` (`js/draw.js` `pickAndCommit` + `js/app.js` `handleDrawClick`): guard `!spinning && available().length`; pick `s = pool[secureIndex(pool.length)]` over the available-only pool; commit `s.status='drawn'`, `current=s`, `history.push({n,status:'drawn',time})` synchronously BEFORE any spin animation or broadcast (DD-03 / RN-SOR-02).
- First draw activates `Session.locked=true` (persists via C-06 autosave in `render()`); `locked=false` initial state from C-02 unchanged. This closes the documented C-04 gap: draw → locked → `isImportBlocked`/`guardedImport` reject round-trip.
- Edges: 0 eligible → `drawBtn.disabled` + `No quedan canciones disponibles` (RN-SOR-04, never a fictitious result); 1 eligible → deterministic pick (RN-SOR-05); any `drawn/played/void` song never re-enters `available()` in the partida (RN-SOR-01, terminal per C-02).
- Mid-spin: draw + played/void confirm disabled; operator texts `SORTEANDO` / `La ruleta está girando… El resultado ya fue elegido` (RN-SOR-06; C-03 `spinning` + cancellable reveal reused as-is).
- Tests (`tests/draw.test.js`, `node:test` + `assert/strict`, zero installs, AAA, independent literals): no-repeat over N draws, empty blocks, single deterministic, exhausted message/disabled, commit-before-reveal verifiable, FIRST DRAW ACTIVATES LOCKED + draw→import-reject round-trip.

## Capabilities

### New Capabilities

- `draw-no-repeat`: uniform draw without replacement with commit-before-animation, `locked` activation on first draw, edge/disabled/message contract, and mid-spin UI lock — the game rule layer over the C-03 engine.

### Modified Capabilities

- None. `draw-engine` (secureIndex, commit marker, SPIN_MS, spinning guard), `session-models` (`locked`, transitions, views), `import-catalog` (locked-reject guard), `session-persistence` (locked survives refresh) are consumed as-is; this change adds requirements only to the new capability.

## Impact

- Code: `js/draw.js` (`pickAndCommit` gains pool scoping + `locked=true` activation, still commit-before-render); `js/app.js` (`handleDrawClick` guard + disabled states + SORTEANDO texts; `render()` `drawBtn`/`statusText` already partially present, extended with exhausted message).
- Tests: `tests/draw.test.js` extended (6 new seams); no new harness, no installs (`node --test`, `cmd /c` on Windows).
- Docs: C-04 follow-up note resolved (round-trip verified); no VDJ integration claim (manual per DD-01).
- Out of scope: 3 s public-screen buffer (C-08), motivo/void persistence (C-09), CSV export (C-10), admin unlock flow (C-11), file/excel/pdf import (C-05).
