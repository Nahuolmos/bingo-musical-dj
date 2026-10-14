# Design — c-09-confirm-void-reason

## Context

See proposal.md (Why) and `specs/confirm-void/spec.md` for behavior. Current state (read from tree):
- `js/app.js` `setCurrentStatus(status)` already gates on `st.spinning || isPublicBuffer()` and updates song + history via `findLast`, clears `current`, re-renders (which autosaves via C-06). `render()` disables `drawBtn`/`confirmBtn` on `!av.length || spinning || isPublicBuffer()`.
- `skipResult` handler today is only `confirm()` generic → `setCurrentStatus('void')` with no reason (IN-02 breach); `HistoryEntry.motivo` exists (C-02, default `''`) but stays empty.
- C-08 archive contract: C-09 gates on buffer end via `isPublicBuffer()` (draw + played/void disabled through spin + 3 s buffer); delayed reveal adds no history entry (one row per draw for C-10).
- `copyResult` already implements clipboard + `prompt` fallback without mutating state.

## Goals / Non-Goals

**Goals:**
- Close IN-02: mandatory trimmed reason on every `void`, persisted in the entry, visible, refresh-safe.
- Keep all C-03/C-07/C-08 invariants untouched: commit-before-render, terminal transitions, spin+buffer locks, one-entry-per-draw.
- Make `prompt`/`confirm`/`clipboard` injectable seams so unit tests mock boundaries (per javascript-testing-patterns) and only the pre-show smoke touches the real modals.

**Non-Goals:**
- CSV `Motivo` column (owned by C-10; C-09 only guarantees the field exists on the entry).
- Unlock/re-entry flow (owned by C-11; `void` stays terminal here with no re-entry path).
- Schema or transition changes (`mbdj.v1` / `schemaVersion: 1` / `available → drawn → played | void` frozen).
- Replacing `prompt()` with a custom modal (stays native for offline `file://` simplicity; revisit only if UX drill rejects it).

## Decisions

1. **Extend `setCurrentStatus(status, motivo?)`, new `handleVoidRequest(promptFn, confirmFn)` seam.**
   Why: keeps the single confirm path (played passes no motivo; void passes trimmed reason) and gives tests a pure injectable boundary for the modal sequence. Alternative (inline prompt in the click handler) rejected — untestable without real modals and duplicates the gate logic.
2. **Gate order inside void flow: `current/drawn` → `spinning/buffer` → `prompt` → empty-check → `confirm`.**
   Why: cheapest observable guards first; reason is only requested when the void could actually commit (no modal spam mid-spin/buffer). Matches existing guard order in `setCurrentStatus`.
3. **Motivo stored trimmed on the history entry only (song row keeps status; list renders `Anulada — {motivo}` from the entry).**
   Why: entry is the audit record C-10 exports; song stays a catalog row. Alternative (motivo on song too) rejected — duplicates source of truth and risks drift after refresh.
4. **Persistence reuses the existing `render()` → `persistCurrentState()` autosave; no `js/store.js` change.**
   Why: motivo rides inside the snapshotted `history` array already covered by C-06 round-trip tests. No migration, no version bump.
5. **Render escapes motivo via existing `esc()` in list + history (same as title/artist).**
   Why: reason is free text — closes the stored-markup surface without new helpers.
6. **CRITICO governance: apply requires explicit human approval before any code edit (audit-adjacent change).**
   Why: void-terminal + motivo-visible alters the evidentiary record; planning is safe to merge, implementation must be human-authorized per CHANGES.md governance.

## Risks / Trade-offs

- [Risk] Native `prompt()`/`confirm()` are blocking and ugly mid-show → Mitigation: sequence runs only post-reveal (buffer elapsed), operator already idle; drill item in checklist validates acceptability; custom modal deferred as non-goal.
- [Risk] Operator mashes confirm during buffer and perceives a freeze → Mitigation: buttons stay visibly disabled through spin+buffer (existing C-08 predicate); void request seam returns early with no modal while gated.
- [Risk] Long/free-text motivo bloats history/CSV → Mitigation: trim + cap display length in render only (store full text); C-10 CSV keeps full text with RFC quoting.
- [Risk] `void` terminal surprises operator (no undo) → Mitigation: double gate (`prompt` + `confirm` with explicit "quedará excluida" copy) + organizer notice; undo explicitly out of scope until a rule is approved (RN-SOR-01).
- [Risk] `findLast` availability on older Chrome → Mitigation: keep the existing index-loop fallback already in `setCurrentStatus`/`setHistoryStatus`.

## Migration Plan

- No migration: additive field use within existing snapshot; old snapshots (motivo `''`/missing) render as plain `Anulada` — forward-compatible.
- Rollback: revert `js/app.js` handlers + render copy; entries already voided keep their motivo (harmless — C-10 still exports it).
- Deploy: planning-only change; on human approval, implement behind the task list, run full suite (`npm test` Node + `tests.html` mirror), then `file://` smoke in the C-11 drill.

## Open Questions

None blocking — IN-02 resolves as "motivo en texto libre persistido en historial + CSV (vía C-10)". Deferred UX question (non-blocking): max motivo length + whether to add a quick-pick list of common reasons — safe to answer post-apply without changing specs or tasks.
