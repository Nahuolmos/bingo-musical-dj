# Design

## Context

See proposal.md (Why) and `specs/session-persistence/spec.md` for the behavior contract. Current state: `js/store.js` is an in-memory stub (`save/load/clear` over a `mem` var, C-01 load order final); `js/core.js` freezes `Session {songs, history, current, spinning, locked, startedAt, schemaVersion: 1}` (C-02 archived ✓). No persistence exists — `render()` starts from zero (IN-06). Constraints: classic `<script>` only (no `type="module"`, `file://` CORS), offline-first, zero installs, Node `node:test` harness + `tests.html` mirror.

## Goals / Non-Goals

**Goals:**

- Round-trip the exact C-02 session shape through `localStorage mbdj.v1` with zero new dependencies.
- Make every failure mode loud: corrupt → empty + message; no-storage → warning + playable; unexported history → `beforeunload`.
- Keep seams testable in Node by injecting storage, so TDD runs with `cmd /c "npm test"` / `node --test`.

**Non-Goals:**

- No IndexedDB, no migration engine for future schemas (unknown version → corrupt path), no cross-tab sync, no encryption, no auto-export of CSV (C-10 owns the out-of-band backup), no lock-guard UI (C-11 consumes `locked` from here).

## Decisions

- **`localStorage` over IndexedDB.** Rationale: synchronous, `file://`-safe, portable, enough for <1000 songs; IndexedDB adds async complexity and a second failure surface for no v1 benefit. Alternative rejected: IndexedDB (async + quota UX worse for a DJ under time pressure). Decision recorded for IN-06.
- **Store stays a tiny boundary module (`save/load/clear/isAvailable`), app owns policy.** `js/store.js` serializes one plain-JSON snapshot and swallows nothing — it returns `{ok, reason}` so `js/app.js` decides banner vs. warning. Rationale: keeps the only mocked seam at the storage boundary (per javascript-testing-patterns: mock boundaries only), and keeps `render()` hook to 2–3 lines. Alternative rejected: store manipulating DOM directly (untestable in Node, shotgun surgery).
- **Save on every `render()`, never debounce.** Rationale: draws are infrequent human actions; the cost of a <100 KB `JSON.stringify` per render is negligible and eliminates "forgot to save mid-giro" races. Alternative rejected: debounced/interval saves (lose the last draw on crash — exactly the P0).
- **Validate-then-hydrate on boot; never partial-apply.** Boot reads raw string → `JSON.parse` in `try/catch` → shape-check (`Array songs/history`, `schemaVersion===1`, `current` null-or-drawn-song) → either full hydrate + banner or empty + corrupt message. Rationale: a half-restored `history` without matching `songs` breaks `n`-monotonicity and C-09/C-10 audits. Unknown `schemaVersion` takes the corrupt path (fail loud, no silent migration).
- **Banner + `confirm()`-gated discard, plain DOM in `index.html`.** Rationale: mandatory acknowledgement satisfies RN-X-03 with zero styling risk; reuses existing `confirm()` discipline from RN-SES-02. No new CSS framework, no modal library.
- **`beforeunload` keyed off an `exportedAt` marker, not history length.** `app.js` records `exportedAt = savedAt-of-last-export`; guard fires only when newest history entry is newer than `exportedAt`. Rationale: avoids nagging after the DJ already exported at end of day 1.

## Risks / Trade-offs

- [Risk] `localStorage` quota / `file://` blocking in hardened browsers → Mitigation: `isAvailable()` probe on boot + `try/catch` on every save; no-storage warning path keeps the show playable in memory.
- [Risk] Operator dismisses banner without checking history and double-draws → Mitigation: banner text explicitly orders "verificá historial antes de seguir"; discard requires `confirm()`, dismiss does not clear storage.
- [Risk] Corrupt payload from a half-written save (crash mid-`setItem`) → Mitigation: single atomic `setItem` of one JSON string per render (no multi-key torn writes); corrupt path boots empty with message.
- [Risk] `spinning=true` persisted mid-giro then reloaded → Mitigation: hydrate forces `spinning=false` (transient UI flag, never restored as spinning); the committed `current`/`history` still restore, so no draw is lost or duplicated.
- [Trade-off] Synchronous stringify on every render blocks the main thread for large lists → Accepted: event-scale lists (<1000 rows) stringify in single-digit ms; correctness beats micro-perf here.

## Migration Plan

- No data to migrate (stub held memory only). Deploy: replace `js/store.js` body, hook `render()` + boot + banner + `beforeunload` in `js/app.js`, add banner node in `index.html`. Rollback: revert the three files; worst case the DJ loses autosave but the in-memory show still runs (same as pre-change).
