# Tasks

## 1. Parsing seams (normalizeLine + parseText)

- [x] 1.1 RED: add failing tests for separators (`,`, `;`, tab), header skip, numbering strip, title-only in `tests/import.test.js`; verify with `cmd /c "node --test tests/import.test.js"` showing the new tests failing.
- [x] 1.2 GREEN: freeze `normalizeLine`/`parseText` in `js/import.js` to pass 1.1 (verbatim regexes kept); verify with `cmd /c "node --test tests/import.test.js"` all parsing tests passing.
- [x] 1.3 TRIANGULATE: add independent-literal cases (en-dash/em-dash variants, `Titulo;Artista` header with `;`, URL-led row fallback, `02)` numbering); verify with `cmd /c "node --test tests/import.test.js"` passing.

## 2. Dedupe and report (nothing silent)

- [x] 2.1 RED: add failing tests for dedupe (diacritics/case/space-collapse), intra-batch vs against-list, empty input message, `importSongs` `{added, duplicates, message}` shape; verify new tests fail via `cmd /c "node --test tests/import.test.js"`.
- [x] 2.2 GREEN: freeze `dedupe`/`importSongs` report strings (`N nueva(s), M duplicado(s) omitido(s)`, `No se detectaron…`); verify full `tests/import.test.js` passes and no catalog mutation on empty input.
- [x] 2.3 Mirror parsing+dedupe cases in `tests.html` (same literals as Node tests); verify by opening `tests.html` via double-click/`file://` and confirming mirror section passes.

## 3. Demo seed, review surface, locked guard

- [x] 3.1 RED: add failing tests for demo 12 (first press adds 12, second adds 0) via `buildDemoSongs`+`importSongs`, review helpers (counters/filter/`Artista no especificado` label), and locked rejection (paste/demo blocked when `core.state.locked=true`); verify new tests fail.
- [x] 3.2 GREEN: wire `sampleBtn`/paste handlers through shared `isImportBlocked()` guard in `js/app.js` (no-op + blocked message pointing to C-11 unlock, no `locked` mutation) and demo via same `importSongs` path; verify new tests pass with `cmd /c "node --test tests/import.test.js"`.
- [x] 3.3 Document blocked-locked string + offline formats in code comment and `docs/ESTRUCTURA.md` reference if touched; verify string matches tests literally (copy-paste check).

## 4. Integration verification

- [x] 4.1 Run full suite `cmd /c "node --test tests/"` and verify zero failures, no new failures in `core/draw/store/public/structure/transport` suites.
- [ ] 4.2 File-smoke: open `index.html` via double-click (`file://`) in Chrome/Edge, paste 3 lines + CSV `;` row + demo 12, confirm counts message, filter, and locked-attempt blocked message (manual checklist, no code change); verify against spec scenarios. — PENDING-HUMAN (no browser tool in agent env; Node-equivalence verified via check-tests-html.cjs + full suite).
  - NOTA 2026-10-13 (pendiente-hasta-C-07, opción B): smoke real "sortear → importar debe rechazar" NO verificable en C-04 por diseño — nada pone `locked=true` al primer sorteo (`js/draw.js:pickAndCommit` líneas 46-68 no toca `locked`; `js/app.js:handleDrawClick` líneas 147-182 no lo muta; `js/core.js:17,74` solo inicializa `false`; activación asignada a C-07 por CHANGES C-02/C-07 + design decisión 5 "no locked mutation"). Guard `isImportBlocked()` (`js/app.js:213-215`) solo dispara con `locked` seteado a mano (tests). NO implementar activación mínima aquí (rompería contrato C-04 proposal Impact + Non-Goals C-07 draw commit). Repro Node: `pickAndCommit(0) → locked=false → handlePasteImport added=1`. C-07 debe cerrar el round-trip draw→locked→reject; C-11 el desbloqueo. Anotar en archive-note que el escenario "Import blocked when locked" del spec queda verificado solo a nivel guard unitario hasta C-07.
- [x] 4.3 Run `cmd /c "openspec validate --change c-04-import-text-csv-demo"` and verify planning artifacts pass validation.

## Workflow follow-up

- Apply the change (`/opsx-apply` or apply workflow) only on a new user request.
- Archive with `/opsx:archive c-04-import-text-csv-demo` after review gates pass.
