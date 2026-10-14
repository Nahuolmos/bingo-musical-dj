# Archive Note — c-05-import-file-excel-pdf

**Archived:** 2026-10-14 → `openspec/changes/archive/2026-10-14-c-05-import-file-excel-pdf/`
**Schema:** spec-driven
**Sync:** new main spec `openspec/specs/import-file/spec.md` (6 requirements, ADDED-only delta; Purpose copied verbatim). `openspec validate --specs` → 12/12 valid (incl. new `spec/import-file`).
**Tasks:** 10/10 complete. All artifacts done (proposal, specs, design, tasks).
**Tests:** full suite 224/224 green (214 baseline + 10 new `tests/import-file.test.js`). `openspec validate c-05-import-file-excel-pdf` clean pre-archive.
**Human drill:** manual `file://` sin red OK — user "Funciona, sigamos" 2026-10-14.
**Commit:** NOT committed — left to operator per C-07..C-11 convention.

## Implementation touched (verify only, not re-implemented)
- `vendor/sheetjs/xlsx.full.min.js` (new, untracked, ~950KB, Apache-2.0 — vendored SheetJS, offline xlsx)
- `tests/import-file.test.js` (new, 10 tests)
- `js/import.js` (modified — extension routing, File.text, xlsx/pdf/docx paths, locked gating)
- `js/app.js` (modified — file input wiring)
- `index.html` (modified — file input + script wiring)
- `tests.html` (modified — new test file wired)
- `docs/PRE_SHOW_CHECKLIST.md` (modified — 11b offline file drill)

## Downstream
- **C-12/C-13** untouched (pending backlog, to be marked discarded later per user decision — NOT in this archive).
- v2 visual C-14 readiness: import surface stable offline; safe base for visual pass.
