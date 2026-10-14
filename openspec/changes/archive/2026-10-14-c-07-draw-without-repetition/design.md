# Design

## Context

See proposal.md (Why). Current state (verified in repo): `js/draw.js` `pickAndCommit(forcedIndex?)` already guards `spinning`, builds `pool = core.available()`, commits `status/current/history/spinning` synchronously, but never touches `locked` — so `js/app.js` `isImportBlocked()`/`guardedImport()` (C-04) can never fire and the C-04 smoke point 5 stays FAIL by design. `js/app.js` `handleDrawClick` already guards `spinning || !available().length`, commits via `pickAndCommit()`, then animates with SORTEANDO texts and disables buttons; `render()` already disables `drawBtn` on `!av.length || spinning` with `No quedan canciones disponibles` for the exhausted case. `js/core.js` `available()` filters `status==='available'`; terminal transitions `available → drawn → played | void` frozen by C-02. `js/store.js` (C-06) autosaves `locked` on every `render()`. Constraints: classic `<script>` order, `file://` portable, Node-safe `require` fallback, `node --test` zero-installs, `cmd /c` on Windows; governance CRITICO, plan-only.

## Goals / Non-Goals

**Goals:**

- Available-only pool scoping + `locked=true` activation inside the existing synchronous commit, persisting via the C-06 autosave path.
- Edge/disabled/message contract (0 → blocked + message, 1 → deterministic, drawn never re-eligible) wired through `render()` + `handleDrawClick`.
- TDD seams for no-repeat over N, empty/single/exhausted, commit-before-reveal, lock activation, and the draw→import-reject round-trip.

**Non-Goals:**

- No 3 s public-screen buffer (`REVEAL_DELAY_MS`, C-08), no motivo/void persistence (C-09), no CSV export (C-10), no admin unlock flow (C-11), no file/excel/pdf import (C-05). No `SPIN_MS`/timer changes (C-03 owns them).

## Decisions

1. **Activate `locked` inside `pickAndCommit`, not in `app.js`.** The commit function sets `st.locked = true` on every successful commit (idempotent after the first). Rationale: single commit owner keeps the invariant "committed draw ⇒ locked" by construction, survives any future second call site, and the C-06 `render()` autosave persists it without a new save path. Alternative (set `locked` in `handleDrawClick`) rejected — splits commit across two modules and a Node/test-only `pickAndCommit` call would silently skip the lock.
2. **Keep pool = `core.available()`, pick `pool[secureIndex(pool.length)]`.** No new RNG; C-03 `secureIndex` reused verbatim. Without-replacement falls out of the status mutation: `drawn` songs fail the `available` filter on the next call. Alternative (separate drawn-set or shuffle-bag) rejected — duplicates C-02 terminal-state machinery and complicates persistence.
3. **Guard order: `spinning` first, then empty pool, then pick.** Returns `null` with zero mutation on either guard (history/current/locked untouched). Rationale: preserves C-03 spinning semantics exactly; empty-pool `null` lets `handleDrawClick`/`render()` own the disabled + message UI without the engine touching DOM.
4. **UI stays in `app.js`; engine stays DOM-free.** `handleDrawClick` keeps its `spinning || !available().length → null` pre-guard, SORTEANDO texts, and button disables; `render()` keeps `drawBtn.disabled = !av.length || spinning` and the `No quedan canciones disponibles` / `Esperando listado` / `Listo para el próximo sorteo` texts. Alternative (engine driving DOM) rejected — breaks Node testability and the classic-script seam split.
5. **Round-trip verified through the real C-04 guard, not a stub.** Tests call `pickAndCommit` then `app.guardedImport`/`isImportBlocked` and assert `blocked:true` + unchanged catalog + verbatim `BLOCKED_MESSAGE`. Rationale: this is the exact C-04 gap (unit guard existed, round-trip never closed); testing through the real seam proves it.

## Risks / Trade-offs

- [Risk] `locked=true` set before animation could strand a session locked on a mid-spin crash → Mitigation: `locked` persists by design (C-06 restores it with the recovery banner); admin unlock (C-11) is the documented recovery, not silent reset.
- [Risk] Exhausted-vs-empty message confusion in `render()` (`!songs.length` vs `!av.length`) → Mitigation: keep the existing two-branch copy (`Esperando listado` vs `No quedan canciones disponibles`) and pin each branch with its own test literal.
- [Risk] `forcedIndex` seam masking non-uniformity in no-repeat tests → Mitigation: no-repeat tests use the secure path (no argument) plus one deterministic `forcedIndex` test only for pool-scoping; production call sites keep passing no argument (C-03 invariant re-asserted).
- [Risk] C-08/C-09 reading `locked` or `current` mid-spin → Mitigation: no new fields, no `spinning`/`current` lifecycle change; C-08 buffer and C-09 confirm build on the frozen contract.

## Migration Plan

Pure in-place change, no data migration: `draw.js` gains two commit lines (`locked`), `app.js` keeps/guards UI copy. `schemaVersion` unchanged (C-02 `1`). Rollback = revert two files. Verify with `cmd /c "node --test tests/draw.test.js"` + `cmd /c "node --test tests/"` + `file://` smoke (cargar demo → sortear → locked → intento de importar rechazado → agotar → mensaje) + `cmd /c "openspec validate --change c-07-draw-without-repetition"`.

## Open Questions

- None blocking. Copy wording of the exhausted message (`No quedan canciones disponibles`) is frozen by the spec; any rewording is a follow-up change with test-literal updates.
