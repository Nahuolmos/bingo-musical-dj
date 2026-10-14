# Proposal — c-11-session-lock-guards-offline-drill

## Why

C-07 activates `Session.locked=true` on the first draw but nothing lets the operator legally leave that state: C-09's fix blocks clear/reset while locked, so a locked session can only be escaped via "Descartar y empezar de cero" (data loss) — there is no IMPORT guard completion, no EDIT guard, and no administrative unlock writer. C-11 closes v1 (last change before show-ready) by adding the audited admin unlock plus the missing guards and proving the whole multi-file route works offline on the event machine with a signed drill.

## What Changes

- **Lock guards (extend, don't duplicate C-09 fix):** while `locked=true`, paste/demo/file imports, clear/reset, and any list edit stay disabled in UI and refuse in the seam (`BLOCKED_MESSAGE` verbatim reuse); refusal is total — no confirm modal, no timer cancel, no state mutation.
- **Administrative unlock (the missing writer):** explicit "Desbloqueo administrativo" action requiring motivo obligatorio (trimmed, non-empty, `prompt()` seam mirroring `handleVoidRequest`) + doble `confirm()`; on success sets `locked=false`, appends an auditable song-less entry to history (C-09 `HistoryEntry.motivo` shape, visible in panel + CSV Motivo column via C-10 6-col writer), and persists via C-06 autosave.
- **Clear/reset semantics kept:** unlocked clear/reset keep single `confirm()` (double with history), cancel spin timer + public buffer (C-03/C-08, no ghost reveals), wipe songs+history+current; locked clear/reset stay refused (C-09 fix, spec-frozen here).
- **Offline drill + signed checklist:** end-to-end route demo/pegar/CSV → sortear → pública 3 s → confirmar/anular → refresh (C-06) → blocked-edit attempt → exportar, all without internet; CDN deps (pdf.js/mammoth) documented with proven paste-text contingency; `docs/PRE_SHOW_CHECKLIST.md` extended with day-1→day-2 persistence + lock items and a signature line; consolidates ALL deferred manual smokes (C-07 file://, C-08 projector move, C-09 confirm/void, C-10 4.3 file://+Excel) into one user-executed drill group.
- **Tests:** edit-with-locked blocked without admin path; unlock without motivo blocked; unlock lands in history+CSV and persists across refresh; clear/reset mid-spin+buffer leave no ghost reveal; full route green without network in multi-file layout.

## Capabilities

### New Capabilities

- `session-lock`: session list freeze + administrative unlock. Owns: locked guards over import/file/edit/clear/reset (UI disabled + seam refusal with shared `BLOCKED_MESSAGE`), the admin unlock seam (motivo + double-confirm + `locked=false`), its auditable history entry shape, and its persistence through the existing autosave.

### Modified Capabilities

- `history-export`: unlock audit entries move from reserved/tolerant render (C-10) to actually written — C-11 is the WRITER that appends the song-less unlock entry with motivo, which the 6-column CSV (`Nº,Título,Artista,Estado,Hora,Motivo`) then carries.

## Impact

- Code: `js/app.js` (unlock seam `handleUnlockRequest` + edit guard + admin button wiring + locked UI disables), `js/core.js` (unlock entry factory, no shape change), `js/store.js` (no change — existing autosave carries `locked=false` + entry), `docs/PRE_SHOW_CHECKLIST.md` (drill consolidation + signature), `tests/session-lock*.test.js` (extend C-09 lock patterns).
- No API/network changes; `file://` + Chrome/Edge + offline-first constraints unchanged; no VirtualDJ automation claimed (manual buffer stays).
- Dependencies: C-06 (persist) + C-10 (6-col CSV) must stay green; C-09 `BLOCKED_MESSAGE` copy and `HistoryEntry.motivo` shape are frozen contracts this change reuses verbatim.
