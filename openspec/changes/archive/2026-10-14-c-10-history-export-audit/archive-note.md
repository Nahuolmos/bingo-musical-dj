# Archive Note — c-10-history-export-audit

**Archived:** 2026-10-14 → `openspec/changes/archive/2026-10-14-c-10-history-export-audit/`
**Schema:** spec-driven
**Sync:** new main spec `openspec/specs/history-export/spec.md` (8 requirements, ADDED-only delta; Purpose copied verbatim). `openspec validate --all` → 11/11 valid (10 specs + change).
**Tasks:** 12/13 complete. Task 4.3 (manual `file://` + Excel smoke) explicitly DEFERRED to the C-11 pre-show drill — no browser/Excel in this environment. Recorded in `tasks.md`, NOT marked done. Precedent: C-07/C-08 file:// smokes deferred identically.
**Tests:** full suite 193/193 green (`tests/history-export.test.js` 24 new). `tests.html` untouched (only BOM assert, intact — zero drift).
**Human approval:** explicit user approval 2026-10-14 ("lanzalo") to archive with the 4.3 deferral noted.

## Notable fixes
1. **Real time bug** — inline `toLocaleTimeString` gave 12h "a. m." output; fixed via `core.formatTime` reuse (1-line fix in `js/draw.js`).
2. **Header `Nº` U+00BA wins over `N°` U+00B0** — spec + KB agree on `Nº`; implementation aligned.
3. **C-08 single-writer invariant intact** — delayed public reveal adds no history row (one draw = one entry = one CSV row).

## Implementation touched (verify only, not re-implemented)
- `tests/history-export.test.js` (24 new)
- `js/app.js` — 6-col `buildCsv` + `sanitizeCsvCell` `'`-prefix + `historyExportNotice` + unlock-tolerant render/export + wiring
- `js/draw.js` — 1-line time fix (`core.formatTime` reuse)
- `docs/PRE_SHOW_CHECKLIST.md` — item 7 → 6-col + 7b day-1 export

## Downstream
- **C-11** writes unlock entries (tolerant render/export ready) + runs the deferred 4.3 drill + all prior file:// smokes (C-07/C-08/C-09/C-10).
