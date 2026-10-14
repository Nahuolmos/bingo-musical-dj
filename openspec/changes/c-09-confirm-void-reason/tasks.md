# Tasks — c-09-confirm-void-reason

## 1. Played confirmation + confirm gates (TDD)

- [x] 1.1 Played happy path via `findLast` clears `current` — add `tests/confirm-void.test.js` with commit→`finishCommit`→`setCurrentStatus('played')` asserting song+entry `played`, `current=null`; verify with `node --test tests/confirm-void.test.js`
- [x] 1.2 Played blocked mid-spin / mid-buffer / without `drawn` current — extend `tests/confirm-void.test.js` (injected public-timer fake for buffer, no wall clock) asserting no-op in each gate; verify with `node --test tests/confirm-void.test.js`
- [x] 1.3 Operator buttons gate on current/spin/buffer — stub-DOM `render()` test asserting `confirmBtn` (+ `drawBtn`) disabled without `current`, mid-spin, and mid-buffer, enabled post-reveal; verify with `node --test tests/confirm-void.test.js`

## 2. Void with mandatory reason (TDD)

- [x] 2.1 Empty/whitespace reason blocks void — `handleVoidRequest` seam test with mocked `promptFn` returning `''`/`'   '` asserting song/history/`current` unchanged; verify with `node --test tests/confirm-void.test.js`
- [x] 2.2 Cancelled prompt or declined confirm aborts — seam tests (`promptFn→null`, `confirmFn→false`) asserting zero mutation; verify with `node --test tests/confirm-void.test.js`
- [x] 2.3 Valid trimmed reason voids with organizer copy — seam test asserting song+entry `void`, `motivo` trimmed on entry, `current=null`, and `Incidencia registrada`/`Informá al organizador` copy present in `js/app.js`; verify with `node --test tests/confirm-void.test.js`
- [x] 2.4 Motivo visible and escaped in list/history — stub-DOM `render()` test asserting `Anulada — {motivo}` row plus escaped `<script>` reason (`&lt;script&gt;`, no live tag); verify with `node --test tests/confirm-void.test.js`

## 3. Terminality, persistence, copy + pre-show evidence (TDD)

- [x] 3.1 Void terminal with no re-entry — test asserting voided id never returns in `available()` across subsequent draws and terminal transitions reject `void → available`; verify with `node --test tests/confirm-void.test.js`
- [x] 3.2 Motivo survives C-06 save/load round-trip — in-memory storage seam test (`store.save`→`store.load`) asserting restored entry keeps `void` + motivo; verify with `node --test tests/confirm-void.test.js`
- [x] 3.3 Copy title–artist leaves draw state untouched — clipboard-mock + `prompt`-fallback tests asserting `title — artist` format (title-only when artist empty) with song/history/`current` unchanged; verify with `node --test tests/confirm-void.test.js`
- [x] 3.4 Mirror + checklist + full suite green — add C-09 mirror block to `tests.html`, add confirmar/anular offline item to `docs/PRE_SHOW_CHECKLIST.md`, run full `node --test` suite with zero regressions; verify with `node --test tests/` output pasted in the apply note

## Workflow follow-up

- Apply requires explicit human approval before any code edit (CRITICO governance, audit-adjacent) — do not start implementation from this planning session.
- Archive the change after review requirements are satisfied (`/opsx:archive c-09-confirm-void-reason`), syncing the `confirm-void` spec to main specs.
