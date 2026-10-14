# Design: c-05-import-file-excel-pdf

## Context

See proposal.md (Why). Current state: `js/app.js` `fileInput.change` routes `txt/csv/tsv` → `File.text()` → `parseText`/`importSongs`; `pdf` → cdnjs pdf.js 3.11.174 + worker → page-text join; `docx` → cdnjs mammoth 1.8.0 → `extractRawText`; else incompatible copy (without XLSX). `accept=".pdf,.docx,.txt,.csv,.tsv"`. C-04 froze `normalizeLine`/`parseText`/`dedupe`/report copies in `js/import.js`; C-11 owns `BLOCKED_MESSAGE` + `guardedImport` funnel. Constraints: classic `<script>` only (no bare `type="module"`, breaks `file://`), no bundler, offline-first main path, `Session.locked` immutable mid-partida.

## Goals / Non-Goals

**Goals:**
- `.xlsx` works offline with zero network (vendored SheetJS, classic script).
- File matrix + error copies frozen and testable through pure seams (Node `--test`).
- Locked gating identical to paste/demo; no new lock semantics.

**Non-Goals:**
- No changes to `parseText`/`dedupe` rules, draw engine, public timing, persistence, history CSV, or unlock flow.
- No multi-sheet UI, no styled-cell/merged-cell handling, no PDF-scanned OCR.
- No CDN vendoring of pdf.js/mammoth (stays progressive with proven fallback).

## Decisions

1. **`.xlsx`: SheetJS vendored local (`vendor/sheetjs/xlsx.full.min.js`) over "export-to-CSV-only" procedure.**
   Rationale: discovery demands `.xlsx` direct; CSV-only leaves IN-05 half-open and forces operator fiddling pre-show. Vendored file (~800 KB, Apache-2.0/MIT-compatible license to verify at apply) loads from disk via relative path so `file://` + offline both work, honoring hard rule 3 (no CDN for main path). Fallback message stays for corrupt/empty sheets.
   Alternative considered: official "exportar a CSV / pegar" with no code — rejected (operator burden, IN-05 unresolved).

2. **XLSX→text bridge reuses the frozen pipeline: `sheet_to_json(header:1)` → row join → `parseText`.**
   Rationale: zero new parsing semantics; header-skip, `;`/tab/`,`, numbering-strip, URL-fallback, `title|artist` dedupe all inherited and already tested. New code is only row serialization (`cells.join(',')` per row, skip all-empty rows) + a `parseXlsxBuffer(arrayBuffer)` seam returning text lines.
   Alternative: direct JSON→song mapping — rejected (duplicates pipeline, risks drift from C-04 freeze).

3. **On-demand local loader mirrors `loadScript` but for relative vendor path.**
   Rationale: `loadScript('vendor/sheetjs/xlsx.full.min.js')` reuses the guarded dedupe-by-`src` pattern; PDF/DOCX cdnjs paths untouched. `XLSX` global check (`window.XLSX`) gates skip. Tests inject a fake `XLSX` global + ArrayBuffer fixtures, never the real 800 KB bundle.
   Alternative: static `<script src="vendor/...">` on every boot — rejected (pays parse cost for shows that never use Excel).

4. **Copy updates are additive and frozen in spec:** incompatible message gains `o XLSX`; new xlsx-empty message `No se detectaron canciones en el Excel. Exportá la hoja a CSV o copiá el texto y usá "Pegar texto".`; PDF/DOCX offline copy unchanged; `BLOCKED_MESSAGE` reused verbatim (copy-paste equality asserted).
   Rationale: existing tests assert old copies; spec pins the new strings so apply updates tests + code together.

5. **Locked guard first in the change handler (before extension sniffing), sharing `isImportBlocked()`/`guardedImport`.**
   Rationale: single funnel, no drift; avoids loading SheetJS/cdnjs while locked. Input reset in all terminal branches (`finally { e.target.value='' }` preserved).

## Risks / Trade-offs

- [Risk] Vendored SheetJS size (~800 KB) bloats repo → Mitigation: single minified file under `vendor/sheetjs/` + README note; lazy-loaded only on `.xlsx` choice, never on boot.
- [Risk] `file://` script injection of relative vendor path blocked by strict CSP/local policy → Mitigation: fallback to the CSV-export message on load failure (same visible path as PDF-offline); drill step covers it.
- [Risk] First-sheet-only ignores multi-sheet workbooks → Mitigation: documented limitation in help copy + checklist ("usá la primera hoja"); no silent cross-sheet merge.
- [Risk] Encoding edge (UTF-16 CSV with BOM, Latin-1 `;`) mis-split → Mitigation: matrix tests with BOM/encoding fixtures; `File.text()` decoding relied upon, failures land on nothing-detected message, never silent.
- [Risk] License of vendored bundle → Mitigation: apply task verifies `LICENSE` header permits redistribution before committing the file.

## Migration Plan

- Additive only: new `accept` token, new vendor file, new `xlsx` branch + `parseXlsxBuffer` seam; no state migration (`mbdj.v1` untouched), no spec archive side effects beyond new `import-file` capability.
- Rollback: delete vendor file + revert handler branch; paste/CSV/demo path unaffected.

## Open Questions

- None blocking. Confirm at apply: exact SheetJS build version pinned (latest stable 0.18.x at vendoring time) and its license header.
