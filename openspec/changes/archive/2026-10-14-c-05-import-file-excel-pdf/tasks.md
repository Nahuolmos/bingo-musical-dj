# Tasks: c-05-import-file-excel-pdf

## 1. Vendored xlsx seam (TDD RED→GREEN)

- [x] 1.1 RED: add failing `tests/import-file.test.js` for `parseXlsxBuffer` seam (first-sheet rows → text lines, empty-sheet → empty, injected fake `XLSX` global, no network) and verify it fails via `node --test tests/import-file.test.js`
- [x] 1.2 GREEN: vendor `vendor/sheetjs/xlsx.full.min.js` (verify license header permits redistribution) + implement `parseXlsxBuffer(arrayBuffer)` row-join bridge feeding existing `parseText`, and verify `node --test tests/import-file.test.js` passes without touching `js/import.js` frozen functions
- [x] 1.3 Mirror the new suite in `tests.html` and verify the browser mirror lists the same cases (open `tests.html` shows import-file section)

## 2. File-handler matrix + locked gating (TDD RED→GREEN)

- [x] 2.1 RED: extend `tests/import-file.test.js` with extension routing (`.xlsx/.txt/.csv/.tsv/.pdf/.docx` vs incompatible `lista.png`), `;`/tab/encoding CSV rows, offline-simulated PDF/DOCX fallback copy, and locked `BLOCKED_MESSAGE` verbatim refusal (no lib load), and verify new cases fail via `node --test tests/import-file.test.js`
- [x] 2.2 GREEN: extend `index.html` `accept` with `.xlsx` + help copy, wire `js/app.js` `fileInput.change` xlsx branch (guard-first locked check, `loadScript('vendor/sheetjs/...')`, updated incompatible copy, xlsx-empty fallback copy, `finally` input reset), and verify `node --test tests/import-file.test.js` passes
- [x] 2.3 Regression: run the full suite via `node --test tests/` and verify zero failures in import-catalog/draw/session-lock/history-export (no frozen-copy drift; `grep -r "cdnjs" js/ index.html` still shows only the guarded PDF/DOCX paths)

## 3. Offline contingency docs + help copy

- [x] 3.1 Update `docs/PRE_SHOW_CHECKLIST.md` with the mandatory no-network drill (xlsx+CSV offline OK, PDF/DOCX → visible paste-text fallback) and verify the step reads as executable pre-event instructions
- [x] 3.2 Verify offline-first audit: `grep` proves TXT/CSV/TSV/paste/demo/xlsx paths reference no http/CDN, and the panel help text documents the first-sheet-only + CSV-export fallback

## 4. Integration verification

- [x] 4.1 Run `openspec.cmd validate --change "c-05-import-file-excel-pdf"` and verify clean (6/6 requirements have scenarios, purpose ≥50 chars, descriptions ≤500 chars)
- [x] 4.2 Record evidence table (RED hash → GREEN hash, full-suite count, validate output) in the apply record and verify no test is declared passed without execution output
