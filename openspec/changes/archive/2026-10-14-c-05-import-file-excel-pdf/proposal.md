# Proposal: c-05-import-file-excel-pdf

## Why

The operator's official list often arrives as a file (`.xlsx` from Excel/Sheets, PDF, DOCX, TXT/CSV/TSV), but `fileInput accept` has no `.xlsx` path (IN-05) and PDF/DOCX depend on cdnjs `loadScript` with no proven offline contingency (IN-07). US-001/RN-IMP-01/RN-X-01 require file import with visible errors and an offline-safe main path — this change closes both gaps before the pre-show drill.

## What Changes

- `fileInput` accepts `.xlsx` in addition to `.pdf,.docx,.txt,.csv,.tsv`; extension matrix routes each file to the correct reader.
- `.xlsx` reads via **SheetJS vendored locally** (`vendor/sheetjs/xlsx.full.min.js`, no CDN, stays offline): first worksheet → rows → existing `parseText`/`dedupe` pipeline. Unparsable/empty `.xlsx` falls back to the visible "exportar a CSV / pegar texto" message.
- TXT/CSV/TSV keep the current `File.text()` offline path unchanged (reuses `normalizeLine`/`parseText`/`dedupe` from `js/import.js`, frozen by C-04).
- PDF (pdf.js 3.11.174 + worker) and DOCX (mammoth 1.8.0) keep on-demand `loadScript` from cdnjs; offline/CDN failure surfaces the visible message "verificá internet o usá Pegar texto" (no silent drop).
- All file paths respect `Session.locked` exactly like C-04 paste/demo: blocked → `BLOCKED_MESSAGE` verbatim, no mutation, input reset.
- Visible error matrix: incompatible format, nothing detected, PDF/DOCX-without-internet, corrupt/empty `.xlsx` — each with its frozen copy.
- `docs/PRE_SHOW_CHECKLIST.md` gains the mandatory no-network file-import drill step.

## Capabilities

### New Capabilities

- `import-file`: file-based catalog ingestion — extension routing, vendored `.xlsx` reading, PDF/DOCX progressive enhancement, offline error messaging, and locked-session gating for the file path.

### Modified Capabilities

- None. `import-catalog` requirements (line normalization, CSV/TSV parsing, dedupe, counts, demo, locked paste/demo) are reused unchanged, not modified.

## Impact

- Affected: `index.html` (`accept` attr + help copy), `js/app.js` (`fileInput.change` handler + `loadScript` + new xlsx seam), new `vendor/sheetjs/` (one vendored file, no bundler, classic `<script>`), `docs/PRE_SHOW_CHECKLIST.md`, `tests/` (extension matrix, `;`/tab/encoding, offline-simulated, `.xlsx`).
- No impact on draw engine, public screen timing, session persistence, history export, or lock admin flow (C-11 reuses `BLOCKED_MESSAGE` verbatim).
- Offline-first preserved: TXT/CSV/TSV/paste/demo/`.xlsx` never touch the network; only PDF/DOCX hit cdnjs on demand with proven fallback.
