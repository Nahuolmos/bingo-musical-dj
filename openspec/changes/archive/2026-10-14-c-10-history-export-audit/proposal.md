# Proposal

## Why

Every draw already commits a history entry (C-07) and every void carries a persisted reason (C-09), but the operator has no auditable evidence surface: the in-panel history has no frozen CSV export contract (BOM, RFC quoting, injection sanitization, motivo column), and the entry shape is not reserved for the C-11 administrative-unlock audit entries. Without this, disputes mid-show and the day-1/day-2 evidence handoff have no portable artifact.

## What Changes

- Auditable operator history: ordered `n`, `es-AR HH:MM:SS` time, in-place status `Sorteada/Reproducida/Anulada` (+ motivo from C-09), one row per committed draw — the delayed C-08 reveal adds no duplicate entry (single-writer: commit once in `pickAndCommit`).
- Excel-compatible CSV export `music-bingo-historial.csv`: columns `Nº,Título,Artista,Estado,Hora` + `Motivo`, RFC-4180 quoting, BOM `\ufeff`, anti-injection sanitization for leading `=+-@` (plus tab/CR/LF safety), empty history exports header-only (valid, not silent).
- Entry shape reserves C-11 unlock entries: history/CSV accept non-song administrative entries (unlock with motivo + visible state) without implementing unlock in this change.
- Operator safeguards: large export/reset buttons (< 2 s per action, RN-X-04); reset warns "Exportá el historial primero" without forcing; day-1 export recommended in `docs/PRE_SHOW_CHECKLIST.md` (2-day event).
- No **BREAKING** changes: existing `buildCsv` 5-column output is extended (Motivo column added), entry shape stays backward-compatible (`motivo` defaults `''`).

## Capabilities

### New Capabilities

- `history-export`: auditable history rendering + Excel-compatible CSV export with motivo, sanitization, and unlock-entry reservation.

### Modified Capabilities

- None. `session-models` (HistoryEntry shape), `draw-no-repeat` (single-writer commit), `public-screen` (delayed reveal adds no entry), `confirm-void` (motivo source), and `session-persistence` (history round-trip) are consumed as-is; no requirement text in those capabilities changes.

## Impact

- Code: `js/app.js` (`render` history block, `buildCsv` extend + sanitize helper, export handler `markExported`, reset warning copy already present), `js/core.js` (HistoryEntry shape — no change, only reservation documented), `docs/PRE_SHOW_CHECKLIST.md` (day-1 export item), `tests/history-export.test.js` (new seam file, explicit Node `--test` list).
- No API/storage schema change: history entries remain plain JSON under `mbdj.v1` (C-06); C-11 will write unlock entries into the same array/CSV.
- Dependencies: requires C-08 (one-row-per-draw despite delayed reveal) and C-09 (motivo source). Downstream C-11 writes unlock entries into this history+CSV.
