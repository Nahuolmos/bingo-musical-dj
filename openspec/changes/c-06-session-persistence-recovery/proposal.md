# Proposal

## Why

A mid-show refresh or day-1→day-2 close currently wipes songs, history, `current` and `locked` silently (IN-06, P0). US-012 / RN-X-03 require that a reload either restores the game or warns unambiguously — this is a hard v1 gate (GATE 6: no show-ready without C-06).

## What Changes

- Autosave in `js/store.js` to `localStorage` key `mbdj.v1` on every `render()`: `songs`, `history`, `current`, `locked`, `startedAt` + `savedAt` (documented choice of `localStorage` over IndexedDB for simplicity/portability, `file://`-safe, zero-dep).
- Restore on `index.html` open: hydrate state from `mbdj.v1` and show a mandatory banner "Partida recuperada del HH:MM DD/MM — verificá historial antes de seguir" + "Descartar y empezar de cero" button (with `confirm()`).
- Corrupt backup → empty session + message "Respaldo dañado — se inició vacío, revisá el CSV exportado" (never crash, never half-state).
- `beforeunload` warns only when there is unexported history.
- No-storage mode (private browsing / blocked `localStorage`): banner warns persistence is unavailable instead of failing silently.
- Tests (Node `node:test` + `assert/strict`, classic scripts, `file://` smoke): mid-show refresh restores, day-1-close→day-2-open restores, corrupt falls back with message, no-storage warns.

## Capabilities

### New Capabilities

- `session-persistence`: autosave/restore/discard/corrupt-fallback/no-storage-warn/`beforeunload` contract for the DJ session (US-012, RN-X-03).

### Modified Capabilities

- None. `session-models` already freezes `Session {…, locked, startedAt, schemaVersion}` + `motivo` field; this change only serializes that shape (round-trip covered as a scenario here, no requirement change there).

## Impact

- Touched: `js/store.js` (real implementation replaces in-memory stub), `js/app.js` (hook save into `render()` + restore-on-boot + banner/discard + `beforeunload`), `index.html` (banner container + dismiss wiring, no visual redesign), `tests/store.test.js` (+ new coverage; `tests.html` mirror if the harness requires it).
- Untouched contract: `js/core.js` schema (`schemaVersion: 1`) — unknown/future versions fall back to empty with the corrupt message rather than migrating.
- Dependencies: C-02 archived ✓ (schema consumed). Downstream gates: C-09 (motivo persists through restore), C-10 (CSV is the out-of-band backup), C-11 (lock guards assume persistence).
- Risks: `file://` + blocked third-party storage in some browsers → covered by the no-storage warning path, not by extra backends (IndexedDB explicitly out of scope for v1).
