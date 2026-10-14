# Design

## Context

See proposal.md (Why) and `specs/history-export/spec.md` for requirements. Current state observed in repo:

- `js/app.js:buildCsv` (lines 561-568) already emits 5-column BOM CSV with RFC double-quote escaping and CRLF, but has **no Motivo column and no injection sanitization**; export handler (lines 758-762) downloads `music-bingo-historial.csv` via `Blob` + `URL.createObjectURL` and calls `markExported()`.
- `js/core.js:createHistoryEntry` (lines 56-66) already shapes `HistoryEntry {n,id,title,artist,status,time,motivo}` with `motivo:''` default; `setHistoryStatus` (lines 96-108) already stores trimmed motivo on void; C-09 renders motivo escaped in list/history (`js/app.js` lines 310-335).
- Single-writer invariant: only `draw.js:pickAndCommit` appends entries (C-07); C-08 `schedulePublicReveal` callback only broadcasts/renders — never pushes. This change must not add any second writer.
- Reset warning copy already exists (`js/app.js` line 669: "Exportá el historial primero si lo necesitás"); checklist (`docs/PRE_SHOW_CHECKLIST.md` item 7) covers pre-export but has no day-1 recommendation.
- Constraints: classic `<script>` only (no modules, `file://` direct), no CDN on this path, `localStorage mbdj.v1` round-trip must keep new column working (entries already carry motivo).

## Goals / Non-Goals

**Goals:**
- Extend `buildCsv` to 6 columns with motivo + sanitize helper, keeping BOM/RFC/CRLF/Blob path untouched.
- Freeze the unlock-entry reservation (shape + render + CSV tolerance) so C-11 can append admin entries with zero rework here.
- Cover all spec scenarios with `tests/history-export.test.js` following the C-08/C-09 seam style (injectable boundaries, hand-computed expected CSV literals).

**Non-Goals:**
- No unlock control, guard, or `locked` mutation (C-11 owns it).
- No storage schema migration (entries already carry `motivo`; old snapshots without it default to `''`).
- No public-screen changes (read-only contract untouched; projector shows last-5 from same history).
- No stats/cards/theming (C-12 backlog).

## Decisions

1. **Extend `buildCsv(history)` in place (+ `sanitizeCsvCell` pure helper) over a new exporter module.**
   Rationale: single call site, classic-script load order unchanged, minimal diff on the audited path; new module would add load-order risk on `file://` for zero benefit. Alternative (new `js/export.js`) rejected — overkill for one function + one helper.
2. **Sanitization = prefix `'` (single quote) when the raw cell starts with `=+-@`, applied BEFORE RFC quoting.**
   Rationale: Excel/LibreOffice treat `'=cmd` as text while preserving visible content; tab/CR/LF are already neutralized by RFC quoting (quoted field). Order matters: sanitize raw → then quote. Alternative (prefix with space/tab) rejected — alters visible content and breaks round-trip assertions.
3. **Status labels in CSV stay raw (`drawn/played/void`) while panel history shows `Sorteada/Reproducida/Anulada`.**
   Rationale: matches existing `buildCsv` behavior and checklist item 7; machine-stable values for evidence; display mapping lives only in `render()`. Alternative (localized CSV values) rejected — breaks downstream C-11/C-12 parsing and prior exports.
4. **Unlock reservation = tolerant render/export, not a new entry factory.**
   `render()` history block and `buildCsv` must handle entries with `id` not matching any song (admin entries: `id:'admin-…'`, title like `Desbloqueo administrativo`, visible state, motivo). No `createUnlockEntry` in this change; C-11 adds the writer + guard. Rationale: reserves the contract without shipping dead code or a second writer now.
5. **Empty export = header-only + visible notice; reset keeps existing single-confirm copy.**
   Rationale: RN-HIS-04 + Flujo 5 ("encabezado válido, sin filas"; "advierte sin forzar"). No new modal; notice via existing `importMessage`/status surface.
6. **Tests mirror `tests/confirm-void.test.js` seams: `beforeEach` fresh state, hand-computed CSV literals (independent source of truth), mocked `Blob`/`URL.createObjectURL`/anchor only.**
   Never assert via the builder's own output; never mock internal collaborators (`pickAndCommit` stays real). Explicit Node file list per Windows quirk.

## Risks / Trade-offs

- [Risk] Motivo column shifts existing 5-column consumers → Mitigation: additive trailing column only; old files still parse (fewer columns); tests assert exact 6-col header literal.
- [Risk] `'` prefix surprises operators copying motivo text → Mitigation: prefix only on leading `=+-@` cells; plain text untouched; documented in checklist note.
- [Risk] Unlock entries with song-less `id` break `motivoForSong` lookup → Mitigation: lookup already guards by id match; admin entries render from their own row, no song-row dependency; test covers mixed history.
- [Risk] CRLF + BOM regression on non-Excel readers → Mitigation: keep existing BOM+CRLF (already shipped in C-08 baseline); tests assert both bytes literally.
- [Risk] Large history export jank (>2 s, RN-X-04) → Mitigation: string-build is linear; event volumes < 1000 rows; no async change; test asserts synchronous completion on 500-row fixture (no wall-clock flake — measures call completion, not timing).

## Migration Plan

- No migration: additive column + tolerant readers; old `mbdj.v1` snapshots load (missing `motivo` → `''` at render/CSV time, no rewrite).
- Rollback: revert `js/app.js` CSV block + test file; prior 5-col CSVs remain valid evidence.

## Open Questions

- None blocking. Display wording for unlock rows in panel history (e.g. `Desbloqueo — {motivo}` vs generic state pill) is finalized in C-11 when the writer ships; this change only guarantees the row renders and exports without breaking order/parse.
