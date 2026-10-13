# Tasks

## 1. Store boundary — save/restore/clear over injected storage (TDD)

- [ ] 1.1 RED: add failing `tests/store.test.js` cases for save/restore round-trip with independent literals (2 songs + 1 history entry + `current` + `locked:true` + `startedAt`), corrupt fallback, and no-storage warn; verify with `cmd /c "node --test tests/store.test.js"` showing the new cases red.
- [ ] 1.2 GREEN: implement `js/store.js` as `save/load/clear/isAvailable` over injectable storage (default `localStorage`, fallback in-memory probe), key `mbdj.v1`, `{songs, history, current, locked, startedAt, savedAt, schemaVersion: 1}`, atomic single `setItem`, `try/catch` returning `{ok, reason}`; verify the cases from 1.1 go green with `cmd /c "node --test tests/store.test.js"`.
- [ ] 1.3 TRIANGULATE+REFACTOR: add edge cases (empty session round-trip, unknown `schemaVersion` → corrupt path, truncated JSON → empty not throw, `spinning` never persisted as true) with AAA + `beforeEach` fresh storage double mocking only the storage boundary; verify full file green and classic-script load order intact (`js/store.js` still Node-requireable and browser-global `MBDJ.store`).

## 2. App wiring — render hook, boot restore, banner, beforeunload (TDD)

- [ ] 2.1 RED: add failing app-level tests (or `tests/app-restore.test.js` if the harness needs a separate seam) for: boot hydrates and shows "Partida recuperada del HH:MM DD/MM — verificá historial antes de seguir", discard button clears storage after `confirm()`, corrupt boot shows "Respaldo dañado — se inició vacío, revisá el CSV exportado"; verify red with `cmd /c "node --test tests/"`.
- [ ] 2.2 GREEN: wire `js/app.js` — call `store.save(snapshot)` at the end of every `render()`, hydrate on boot with validate-then-apply (full or empty, never partial; force `spinning=false`), render mandatory banner + discard-with-`confirm()` node in `index.html`; verify tests from 2.1 green and banner text matches spec verbatim.
- [ ] 2.3 GREEN: add `beforeunload` guard keyed off `exportedAt` (fires only when newest history entry is newer than last CSV export; cleared on export) plus no-storage boot warning keeping the in-memory game playable; verify by test (guard registered/cleared) and by manual reload check in the task evidence table.

## 3. Integration verification — pre-show proof (no new behavior)

- [ ] 3.1 Run the full portable suite with `cmd /c "node --test tests/"` plus the `tests.html` double-click mirror, and a `file://` smoke in Chrome/Edge: load demo → draw → refresh (restores) → corrupt `mbdj.v1` in DevTools (empty + message) → block storage (warning, still playable); record the evidence table (command, result, screenshot/note) in the apply summary and verify zero regressions in C-01/C-02 seams.

## Workflow follow-up

- Run `openspec validate --change "c-06-session-persistence-recovery"` and fix any warnings before apply.
- Apply only via the apply workflow after explicit user request (governance CRITICO; this proposal authorizes planning only, no production code yet).
- Archive with `/opsx-archive` after review; C-11 consumes `locked` restore from here.
