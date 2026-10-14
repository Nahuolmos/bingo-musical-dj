# Tasks

## 1. Draw without replacement + edges (RED→GREEN)

- [x] 1.1 RED: add failing no-repeat test (N=12 draws over 12 songs via secure path, assert 12 unique ids + `available()` empty + history n=1..12 monotonic) with independent literals and verify it fails via `cmd /c "node --test tests/draw.test.js"`
- [x] 1.2 GREEN: scope `pickAndCommit` to the `available()`-only pool (`pool[secureIndex(pool.length)]`, no new RNG) so drawn songs never re-enter, and verify 1.1 plus existing C-03 suite passes via `cmd /c "node --test tests/draw.test.js"`
- [x] 1.3 Add edge tests (0 eligible → `null` + no history/current/locked mutation; 1 eligible → deterministic literal pick; exhausted catalog → `drawBtn.disabled` + `No quedan canciones disponibles` copy) with AAA + `beforeEach` fresh state and verify via `cmd /c "node --test tests/draw.test.js"`

## 2. First-draw lock activation + import-reject round-trip (RED→GREEN)

- [x] 2.1 RED: add failing lock tests (first `pickAndCommit` sets `locked=true`; second draw keeps it true; `locked` survives a simulated C-06 save/load round-trip; `app.guardedImport`/`isImportBlocked` after one draw returns `blocked:true` with verbatim `BLOCKED_MESSAGE` and unchanged catalog) and verify failure via `cmd /c "node --test tests/draw.test.js"`
- [x] 2.2 GREEN: set `st.locked = true` inside `pickAndCommit` on every successful commit (idempotent, before `spinning=true`, no DOM, no `schemaVersion` change) and verify 2.1 plus full draw suite passes via `cmd /c "node --test tests/draw.test.js"`

## 3. Commit-before-reveal + mid-spin UI lock (RED→GREEN)

- [x] 3.1 RED: add failing commit-order test (commit exists synchronously right after `pickAndCommit` returns and before any `scheduleReveal` callback fires, using the injected timer seam — status `drawn` + `current` set + history entry present) and verify failure via `cmd /c "node --test tests/draw.test.js"`
- [x] 3.2 GREEN: keep the synchronous commit in `pickAndCommit` (status/current/history before `spinning=true`, animation only renders) with the commit-before-render audit comment intact, and verify 3.1 passes via `cmd /c "node --test tests/draw.test.js"`
- [x] 3.3 Add mid-spin UI tests (second `pickAndCommit` while spinning → `null` + unchanged state; `setCurrentStatus` blocked mid-spin; `handleDrawClick` pre-guard + SORTEANDO texts + `drawBtn`/`confirmBtn` disabled; production `pickAndCommit()` call sites pass no argument) and verify via `cmd /c "node --test tests/draw.test.js"`

## 4. Integration + pre-show verification

- [x] 4.1 Run full suite `cmd /c "node --test tests/"` plus `file://` smoke (demo → sortear → locked → paste/demo import rejected with blocked message → exhaust catalog → disabled + message → refresh restores locked via C-06 banner) and verify all green with no C-03/C-04/C-06 regressions
- [x] 4.2 Run `cmd /c "openspec validate --change c-07-draw-without-repetition"` and verify planning artifacts complete (proposal, draw-no-repeat spec, design, tasks)

## Workflow follow-up

- Apply the change separately once confirmed (governance CRITICO); then archive with `/opsx:archive c-07-draw-without-repetition`.
