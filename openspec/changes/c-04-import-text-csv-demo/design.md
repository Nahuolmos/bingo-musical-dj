# Design

## Context

See proposal.md Why. Current state: `js/import.js` holds verbatim `normalizeLine`/`parseText`/`dedupe`/`importSongs` (pure, Node-importable, classic script); `js/app.js` owns `buildDemoSongs`, paste/demo/file wiring, and list render with filter/counters. C-02 froze `Song`, `Session.locked=false` default, `state` shape. Constraints: `file://` double-click, no `type="module"`, no bundler, no CDN on this path, offline-first (AGENTS.md rules 1–3, 7–8).

## Goals / Non-Goals

**Goals:**
- Freeze the offline parse→dedupe→report pipeline and its locked guard with TDD seams testable under `node --test`.
- Keep `MBDJ.import` signatures stable so C-05 (file path) reuses `parseText`/`dedupe` unchanged.

**Non-Goals:**
- File-input handling for TXT/CSV/TSV bytes, PDF/DOCX/XLSX, encoding detection (C-05).
- C-11 unlock UI (motivo + doble confirm + audit entry), C-06 autosave, C-07 draw commit, CSV export (C-10).
- Visual redesign of list/history (verbatim styles from C-01).

## Decisions

- **Decision 1: Keep all parsing pure in `js/import.js`, wiring + guard in `js/app.js`.** Rationale: preserves C-01 seam (`tests/import.test.js` imports `js/import.js` under Node with no DOM) and lets locked rejection be a thin pre-check before calling `importSongs`. Alternative (guard inside `importSongs`) rejected: would couple pure pipeline to session state and complicate Node tests; instead `app.js` handlers check `core.state.locked` first.
- **Decision 2: Freeze verbatim regexes, widen only with tests.** `normalizeLine` keeps `/^\s*(?:\d+[.)-] |[-*•])\s*/` + `/\s+[—–-]\s+/` split; `parseText` keeps tab/`;` first then `,` fallback, header `/^((título|cancion|song|track))\s*[,;\t]/i`, URL guard `/^https?:/i`; `dedupe` key keeps `toLocaleLowerCase + NFD + [\u0300-\u036f] strip + \s+ collapse`. Rationale: matches monolith evidence + existing `tests/import.test.js`; any widening (e.g. `|` separator) needs a new RED test first. Alternative (rewrite parser with a CSV lib) rejected: adds dependency, breaks `file://` offline.
- **Decision 3: Dedupe key `title|artist` order kept, report contract frozen.** `importSongs` returns `{added, duplicates, message}` and writes the exact Spanish strings (`Importación completada: …`, `No se detectaron…`, blocked-locked string). Rationale: C-05/C-10 and checklist docs assert on these strings; changing wording breaks tests. Alternative (structured per-row report) deferred: RN-IMP-02 only needs N/M counts in v1; row-by-row detail is C-05 scope.
- **Decision 4: Demo 12 stays as literal pairs in `app.js:buildDemoSongs`, inserted via `importSongs`.** Rationale: guarantees demo goes through the same dedupe/report path (repeat press = 0 added). Alternative (separate seed function) rejected: would bypass dedupe and risk duplicates.
- **Decision 5: Locked rejection is message + no-op, unlock lives in C-11.** Paste/demo/file handlers show blocked message and return before `parseText` side effects; no `locked` mutation here. Rationale: AGENTS.md rule 7 — no silent bypass; C-11 owns motivo + doble confirm + audit entry. Rejected: auto-unlock or quiet queue.

## Risks / Trade-offs

- [Risk] Comma in title (`Los Palmeras, El Bombón`) mis-split as artist/title → Mitigation: keep `Artista - Titulo` as primary documented format; CSV path documented as `artista,titulo`; triangulate tests lock the behavior; C-05 adds per-row report.
- [Risk] `toLocaleLowerCase` varies by OS locale for Turkish-i edge → Mitigation: acceptable for v1 volumes (<1000 rows); tests use Spanish corpus; note in code comment.
- [Risk] Locked guard added in N handlers drifts (paste vs demo vs file) → Mitigation: single `isImportBlocked()` helper in `app.js` used by all three handlers; one test per entry point.
- [Risk] Header regex over-skips a real song starting with "Song …," → Mitigation: header skipped only on first line AND with separator present; test locks `Song 2, …` data row not skipped when not first line.

## Migration Plan

No migration: additive freeze of existing seam. Rollback = revert `js/import.js`/`js/app.js` to C-02-archived versions; `schemaVersion` unchanged; no storage format change. Deploy = double-click `index.html` + `node --test tests/import.test.js` + `tests.html` mirror smoke.

## Open Questions

- None blocking. Exact blocked-locked Spanish string (e.g. `Lista bloqueada — usá Desbloqueo administrativo…`) is settled at apply time and locked by test; C-11 must reuse the same string.
