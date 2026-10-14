# Tasks

## 1. CSV contract (RED→GREEN per slice, independent hand-computed literals)

- [x] 1.1 RED: add `tests/history-export.test.js` with failing 6-column header + BOM + CRLF case (hand-computed literal `"Nº","Título","Artista","Estado","Hora","Motivo"`), verify it fails with `node --test tests/history-export.test.js`
- [x] 1.2 GREEN: extend `buildCsv` to 6 columns (trailing Motivo, `''` default) + keep BOM/CRLF/RFC quoting, verify the 1.1 test passes with `node --test tests/history-export.test.js`
- [x] 1.3 Motivo + RFC edge: add failing cases for motivo with comma/quote/newline and void motivo in row (hand-computed literals, NOT builder output), implement quoting pass-through, verify with `node --test tests/history-export.test.js`
- [x] 1.4 Sanitization: add failing cases for leading `=`, `+`, `-`, `@` cells (expect `'` prefix before quoting), add `sanitizeCsvCell` pure helper applied pre-quote, verify with `node --test tests/history-export.test.js`
- [x] 1.5 Empty history: add failing header-only case (BOM + exactly one line, zero data rows) + visible-notice seam, implement, verify with `node --test tests/history-export.test.js`

## 2. History audit surface (single-writer preserved)

- [x] 2.1 One-row-per-draw: add failing test that `pickAndCommit → finishCommit → delayed public reveal` leaves exactly 1 entry / 1 CSV row, verify no second writer exists, verify with `node --test tests/history-export.test.js tests/draw.test.js tests/public.test.js`
- [x] 2.2 Order/time/in-place: add failing tests for monotonic `n`, `es-AR HH:MM:SS` time, and `drawn → played | void` in-place update via real `pickAndCommit`, implement render/history tolerance only (no commit change), verify with `node --test tests/history-export.test.js`
- [x] 2.3 Motivo visible + escaped: add failing render tests (stub `document`) for `Anulada — R` in list/history and `<script>` inert, verify with `node --test tests/history-export.test.js`

## 3. Unlock reservation + operator safeguards (no unlock behavior)

- [x] 3.1 Unlock-tolerant history/CSV: add failing tests with a mixed history (2 draw entries + 1 admin-shaped unlock entry with song-less id, motivo, visible state) asserting render + CSV rows keep order and parse, implement tolerance only (no writer/guard/lock change), verify with `node --test tests/history-export.test.js`
- [x] 3.2 Reset warning + checklist: assert existing "Exportá el historial primero" copy stays in reset path (static source check), append day-1 export item to `docs/PRE_SHOW_CHECKLIST.md`, verify by reading the rendered checklist and running `node --test tests/history-export.test.js`

## 4. Full verification + evidence (integration only — no new tests/docs here)

- [x] 4.1 Run the full suite with the explicit Windows file list (`node --test tests/core.test.js tests/import.test.js tests/draw.test.js tests/store.test.js tests/structure.test.js tests/confirm-void.test.js tests/public.test.js tests/history-export.test.js` — plus any other `tests/*.test.js` present) and record the green counts table
- [x] 4.2 Run `openspec validate c-10-history-export-audit` (positional name) and record clean output; fix any finding before apply
- [ ] 4.3 Manual smoke in real browser via `file://`: demo → sortear → confirmar/anular con motivo → exportar → open CSV in Excel (BOM/columns/motivo) → reset shows export-first warning; record PASS/FAIL per step (drill may defer to C-11 pre-show, note it explicitly)
