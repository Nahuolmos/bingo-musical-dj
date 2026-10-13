# Tasks

## 1. Session/Song/HistoryEntry factories + defaults

- [x] 1.1 Add `createSession/createSong/createHistoryEntry` factories with `locked=false`, `schemaVersion=1`, `motivo=''` defaults to `js/core.js` and verify `node --test tests/core.session.test.js` passes (fresh `createSession()` asserts shape, ISO `startedAt`/`addedAt`, empty songs/history, null current)
- [x] 1.2 Extend shared `MBDJ.core.state` literal with `locked/startedAt/schemaVersion` additively and verify existing C-01 core/draw tests still pass unmodified via `node --test tests/`

## 2. Transitions + in-place history update

- [x] 2.1 Add `isValidTransition/setSongStatus` (`available → drawn → played | void`, terminal, reject others without mutation) and verify `node --test tests/core.transitions.test.js` passes (valid forward chain + invalid `available→played`/`played→available`/`void→available` cases from independent literals)
- [x] 2.2 Add `setHistoryStatus(history, songId, next)` in-place via `findLast` with index-loop fallback and verify unit test passes including a case with `Array.prototype.findLast` hidden and `title/artist/n/time` preserved

## 3. Views + pure helpers (n, esc, makeId, time)

- [x] 3.1 Add `total/remaining/drawn` views and verify unit test passes on a mixed 2-available/1-drawn/1-played/1-void fixture asserting 5/2/3
- [x] 3.2 Pin `n = history.length + 1` monotonic + snapshot semantics and verify test passes committing 3 draws asserting `n` 1,2,3 and frozen title/artist after catalog edit
- [x] 3.3 Pin `esc()` neutralization + `makeId()` shape/uniqueness + `es-AR HH:MM:SS` time shape and verify test passes (`<script>` → `&lt;script&gt;`, 1000 ids match `^s[0-9a-z]+$` unique, time matches `/^\d{2}:\d{2}:\d{2}$/`)

## 4. Harness mirror + spec sync

- [x] 4.1 Mirror new `tests/*.test.js` cases into `tests.html` and verify by opening `tests.html` via `file://` double-click in Chrome/Edge with all cases green
- [x] 4.2 Run full `node --test tests/` + `openspec validate --change c-02-session-models-core` and verify zero failures before requesting apply review
