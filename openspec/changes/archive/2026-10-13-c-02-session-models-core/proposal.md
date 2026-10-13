# Proposal

## Why

C-01 split the monolith into load-ordered classic scripts, but `js/core.js` still holds only a verbatim stub state (`songs/history/current/spinning`) with no consolidated domain model. Every later change (C-03 draw engine, C-04 import, C-06 persistence, C-07 no-repetition, C-11 lock) consumes `Song`, `HistoryEntry` and `Session` — without a frozen contract they will diverge. This change defines that contract now, including the two fields later gates depend on (`locked`, `schemaVersion`).

## What Changes

- Consolidate the domain model in `js/core.js` (classic script, `file://`-safe, Node-importable):
  - `Song {id, title, artist, status, addedAt}`.
  - `HistoryEntry {n, id, title, artist, status, time, motivo}` — `motivo` field added HERE (empty string default; C-09 makes it reason-required).
  - `Session {songs, history, current, spinning, locked, startedAt, schemaVersion}` with derived views `total / remaining / drawn`.
- Add `Session.locked: boolean` (initial `false`; semantics: false until first draw — activated by C-07, enforced by C-11) and `schemaVersion: 1` (consumed by C-06 restore).
- Freeze transitions: `Song available → drawn → played | void` (terminal, no re-entry in v1); `HistoryEntry drawn → played | void` updated in-place via `findLast` (with index-loop fallback where `findLast` is unavailable).
- Freeze pure helpers: `esc()` applied on list, history and public render; `makeId()` (`'s' + base36(timestamp) + rand`); `time` formatted `es-AR HH:MM:SS`; `n` unique and monotonic (`history.length + 1` at commit).
- No behavior change to draw/import/persistence/public beyond exposing the model they already use; no new UI, no storage writes, no broadcast changes.

## Capabilities

### New Capabilities
- `session-models`: consolidated domain entities, transitions, views and pure helpers (`esc`, `makeId`, time/n rules) plus `locked`/`schemaVersion` defaults. Covers RN-SOR-01, RN-HIS-01, RN-HIS-03, RN-SES-01 at model level.

### Modified Capabilities
- None. `app-structure` (file layout) and `portable-harness` (test runner) are untouched; this change only fills the `js/core.js` seam they already reference.

## Impact

- Affected code: `js/core.js` only (plus `tests/*.test.js` + `tests.html` mirror additions — no `app.js`/`draw.js`/`import.js`/`store.js`/`public.js` logic changes).
- APIs: `MBDJ.core` surface grows (`createSession`, transition helpers, views); existing `available`/`esc`/`makeId`/`state` signatures preserved for C-01 compatibility.
- Dependencies/systems: none — still offline-first, no bundler, no modules, no CDN, no storage schema write (C-06 reads `schemaVersion` from here).
- Breaking: none.
