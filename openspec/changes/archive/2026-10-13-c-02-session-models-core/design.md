# Design

## Context

See proposal.md (Why). Current state (C-01 output): `js/core.js` is a 45-line verbatim stub — `state {songs, history, current, spinning}`, `makeId()`, `esc()`, `available(list?)` — exposed as `MBDJ.core` classic script, Node-importable via `module.exports` fallback. Consumers already exist: `js/draw.js pickAndCommit()` writes `{n, id, title, artist, status:'drawn', time}` and sets `s.status='drawn'`; `js/app.js setCurrentStatus()` flips `current.status` + in-place history update via `findLast` with index-loop fallback, and renders `total/remaining/drawn` inline; `js/app.js buildDemoSongs()` builds `Song`-shaped objects; `js/store.js` is an in-memory stub awaiting C-06 `mbdj.v1`. Constraints: classic `<script>` only (no `type="module"`, `file://` CORS), offline-first, zero installs (`node:test` + `node:assert/strict`), UTF-8 Spanish UI.

## Goals / Non-Goals

**Goals:**
- Freeze the `js/core.js` model contract (entities, transitions, views, helpers) that C-03/C-04/C-06/C-07/C-11 build on, with `locked`/`schemaVersion` present from day one.
- Keep 100% backward compatibility with C-01 consumers (`available`, `esc`, `makeId`, `MBDJ.state` shape extended only additively).
- Make every rule verifiable with pure `node:test` unit tests + `tests.html` mirror, no DOM/BroadcastChannel/localStorage mocks beyond what exists.

**Non-Goals:**
- No draw/import/persistence/public logic changes (C-03…C-11 own those); no UI, CSS, broadcast, storage, or CSV changes.
- No rename of `MBDJ.*` globals or script load order (owned by `app-structure`).
- No enforcement of `locked` (C-11) or reason-required voids (C-09) — only the fields/defaults they need.

## Decisions

- **Plain-object factories + transition functions in `js/core.js`, no classes.** Rationale: C-06 must JSON-serialize the session to `localStorage mbdj.v1`; class instances break round-trip. Alternative (ES classes with methods) rejected — methods don't survive `JSON.parse` and `type="module"`-free classic scripts favor object literals. Factories: `createSong(title, artist)`, `createHistoryEntry(song, n)`, `createSession()`; transitions: `setSongStatus(song, next)` (validates allowlist), `setHistoryStatus(history, songId, next)` (findLast w/ fallback); views: `total(session)`, `remaining(session)`, `drawn(session)`.
- **Additive state extension only.** Rationale: `draw.js`/`app.js` read `MBDJ.core.state` directly; adding `locked:false`, `startedAt: ISO`, `schemaVersion:1` to the literal keeps them working. Alternative (new `Session` wrapper object) rejected — would force touching every consumer in a CRITICO plan-only change.
- **`motivo: ''` default on HistoryEntry now, enforcement later.** Rationale: KB-04 documents the IN-02 gap (no persisted motivo); adding the field here lets C-09/C-10 persist/export it without a second migration, while `''` keeps current `void` path (`confirm()`-only) passing. Alternative (omit until C-09) rejected — would mean a breaking entry-shape change mid-track.
- **`n = history.length + 1` at commit, snapshot title/artist.** Rationale: matches observed `draw.js` behavior; monotonic without a separate counter that could desync after C-06 restore (length-derived n is restore-safe). Snapshot (not reference) preserves audit evidence per KB-08 pattern.
- **Keep `esc()`/`makeId()` semantics byte-identical, add thin validators.** Rationale: C-01 tests pin verbatim behavior; validators (`isValidSongStatus`, `isValidTransition`) are new pure functions beside them, so existing tests don't churn. `time` stays `toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit',second:'2-digit'})` as in `draw.js`.
- **Tests at agreed seams only (tdd + javascript-testing-patterns).** Seams: transitions, monotonic n, esc(), makeId(), locked/schemaVersion defaults. Stack: `node:test` + `node:assert/strict`, AAA, expected values from independent literals (e.g. hardcoded `'^s[0-9a-z]+$'`, `'<script>'` → `'&lt;script&gt;'`), fresh session per test in `beforeEach`, no mocks (pure model; no WebCrypto/localStorage/BroadcastChannel needed).

## Risks / Trade-offs

- [Risk] `findLast` missing on older Chrome/Edge at the venue → Mitigation: keep the existing index-loop fallback in the new `setHistoryStatus` helper and cover it with a test that temporarily hides `findLast`.
- [Risk] `toLocaleTimeString('es-AR')` varies by OS ICU data → Mitigation: tests assert shape `HH:MM:SS` (`/^\d{2}:\d{2}:\d{2}$/`), not an exact wall-clock value.
- [Risk] `makeId()` collision on same-millisecond rapid imports → Mitigation: retain `Math.random` suffix; tests assert uniqueness over 1000 ids, not cryptographic strength (secure randomness is C-03's `secureIndex`, not ids).
- [Risk] Length-derived `n` could duplicate if entries are ever deleted → Mitigation: document invariant "history is append-only; C-11 reset clears whole session, never splices"; no delete API exposed.
- [Trade-off] Plain objects give no encapsulation (callers can still mutate `status` directly, bypassing validators) — accepted: v1 favors `file://` simplicity over enforcement; C-07/C-09 will route through helpers and review will flag direct mutation.

## Migration Plan

- Forward: apply change adds fields/functions to `js/core.js` additively; `draw.js`/`app.js` keep working unmodified; rollback is deleting the new exports (state literal keeps extra fields harmlessly).
- C-06 compatibility: `schemaVersion: 1` written from creation; restore accepts `1` and defaults missing/older to current shape with a "respaldo dañado" path owned by C-06 (no migration code here).
- Deploy: no deploy — `file://` double-click; verify with `node --test tests/` + open `tests.html`.

## Open Questions

- None blocking. (Noted for later tracks, not this design: whether C-11's admin-unlock entry reuses `HistoryEntry` with a synthetic status or a separate audit kind — C-10/C-11 decide; this change only guarantees the entry shape they extend.)
