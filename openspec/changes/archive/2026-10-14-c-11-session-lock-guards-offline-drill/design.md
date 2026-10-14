# Design — c-11-session-lock-guards-offline-drill

## Context

See proposal.md (Why) and `specs/session-lock/spec.md` for requirements. Current state in `js/app.js`: `isImportBlocked()` + `BLOCKED_MESSAGE` + `guardedImport()` gate paste/demo; `handleClearSongs`/`handleResetAll` refuse while locked (C-09 fix) with no confirm, no timer touch, no mutation; file-input handler has its own `isImportBlocked()` check; `bootRestore` surfaces locked+empty snapshots with banner + discard escape; history render + 6-col CSV already tolerate song-less unlock entries (C-10 reservation) but nothing writes them. The missing writer is the admin unlock seam; the missing guards are list-edit paths (whatever mutates songs outside import/clear/reset) and locked UI disables.

## Goals / Non-Goals

**Goals:**
- One unlock seam (`handleUnlockRequest(promptFn, confirmFn)`) mirroring `handleVoidRequest` gate order, injectable for Node tests, wired to a single explicit admin button.
- Extend (never duplicate) the C-09 guard pattern to every remaining mutation path + visible locked disables in `render()`.
- Persist unlock + entry through the existing C-06 autosave with zero `store.js` changes.
- Consolidate all deferred manual smokes into one signed drill in `docs/PRE_SHOW_CHECKLIST.md`.

**Non-Goals:**
- No new persistence mechanism, no schema bump (`schemaVersion` stays 1; unlock entry fits `HistoryEntry` + motivo).
- No change to spin timing (`SPIN_MS`), reveal buffer (`REVEAL_DELAY_MS`), draw/commit, void, or CSV format.
- No VirtualDJ automation; no edit-history/undo for unlocks (unlock is itself the audit record).

## Decisions

1. **Unlock seam mirrors `handleVoidRequest` exactly** — signature `handleUnlockRequest(promptFn, confirmFn)`, gate order locked? → prompt motivo → trim/empty-check → confirm #1 → confirm #2 → commit. Rationale: pre-agreed TDD seam, literals independently asserted, reviewers already know the pattern. Alternative (single confirm + motivo): rejected — RN-SES demands double confirm for destructive admin acts and the proposal fixes double.
2. **Unlock entry is song-less with visible state** — `{n: history.length+1, id: 'unlock-<timestamp>', title: 'Desbloqueo administrativo', artist: '', status: 'unlock', time, motivo}`. Rationale: fits C-10 tolerant render/CSV (renders `○ Desbloqueo administrativo — motivo`, exports Motivo column) and `store.js` validation (arrays + schemaVersion only) with no migration. Alternative (status `admin` / separate log): rejected — splits the audit trail C-10 unified.
3. **Reuse `BLOCKED_MESSAGE` verbatim, single guard funnel** — all mutation paths (paste/demo/file/edit/clear/reset) route through `isImportBlocked()` + the same copy. Rationale: C-09 tests assert copy-paste equality; one funnel prevents message drift. No new message strings.
4. **Guard-first refusal (no confirm, no timer cancel on refusal)** — locked clear/reset/unlock-abort never touch `cancelReveal`/`cancelPublicReveal`. Rationale: matches C-09 fix semantics; cancelling timers on a refused action would mask in-flight state. Timers cancel only on committed unlocked wipes (existing behavior, spec-frozen).
5. **`locked=false` persists via existing `render()` autosave** — unlock commits then calls `render()` (which persists + broadcasts). Rationale: zero `store.js` change, refresh test passes through `bootRestore` unchanged. Alternative (explicit save call): unnecessary; render always persists.
6. **Drill is user-executed, orchestrator-verified by report** — tasks.md marks the consolidated smoke group `[manual]` with a sign-off line; no Playwright file:// automation claimed. Rationale: regla dura 9 (never declare pass without executing) + the event machine is the only valid offline fixture.

## Risks / Trade-offs

- [Risk] Operator unlocks mid-show to "fix" one song, silently unfreezing the whole catalog → Mitigation: unlock button labeled administrative with motivo + double confirm copy stating the whole list unfreezes; entry stays in history/CSV as evidence.
- [Risk] Song-less entry with `id: 'unlock-…'` collides with a song id → Mitigation: `unlock-` prefix + timestamp + rand; history lookup is by song id for draws only, unlock entries are never looked up.
- [Risk] Locked UI disables missed for a new control → Mitigation: single `isImportBlocked()` predicate consumed by `render()` for all mutation controls; tests assert disabled state while locked.
- [Risk] Offline drill passes on dev machine but fails on event machine (different Chrome/popup policy) → Mitigation: drill MUST run on the event machine per checklist; sign-off records browsers tested.
- [Risk] Double-confirm copy fatigue (operators click through) → Mitigation: second confirm names the consequence ("la lista quedará editable"); accepted v1 trade-off, documented.

## Migration Plan

- Deploy: parted files only, no data migration; old `mbdj.v1` snapshots without unlock entries load unchanged; new unlock entries load on old code as tolerant rows (C-10) — forward/backward safe.
- Rollback: revert `js/app.js` + `js/core.js` + checklist; snapshots containing unlock entries still load (tolerant render), lock state stays consistent via autosave.
