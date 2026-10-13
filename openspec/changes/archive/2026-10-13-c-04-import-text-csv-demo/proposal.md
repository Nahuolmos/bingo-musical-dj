# Proposal

## Why

The show's offline load path (paste text + CSV/TSV + 12-song demo) currently lives as verbatim monolith code in `js/import.js` with no frozen contract: parsing edge cases (separators, header, numbering, diacritics), dedupe reporting, demo seeding, and `Session.locked` gating are implicit. C-04 must freeze that contract before C-05 (file/Excel/PDF), C-07 (draw consumes the catalog), and C-11 (admin unlock) build on it — otherwise import behavior will diverge mid-show and duplicates or silent drops will go unnoticed.

## What Changes

- Freeze offline import contract in `js/import.js` (classic script, `file://`-safe, Node-importable, no CDN):
  - `normalizeLine`: skip empty, strip numbering (`1.`/`2)`/`-`/`*`/`•`), split `Artista - Titulo` on first `\s+[—–-]\s+`, title-only yields `artist=''`.
  - `parseText`: detect CSV/TSV (`,`/`;`/tab, ≥2 cells → celda[0]=artista, resto=título, salvo URLs `http`), skip header row (`titulo/cancion/song/track` + separator), delegate rest to `normalizeLine`, intra-batch `dedupe`.
  - `dedupe` + `importSongs`: normalized key `lowercase + NFD sin diacríticos + espacios colapsados` on `title|artist`, intra-import and against existing list; always report `"N nueva(s), M duplicado(s) omitido(s)"` — never silent; empty input reports `"No se detectaron canciones…"`.
  - `sampleBtn` / demo 12: fixed 12-song set, inserted via same `dedupe` path (no duplicates on repeat press); list shows filter, states, counters, `"Artista no especificado"` for `artist=''`.
  - Respect `Session.locked` (from C-02): when `locked=true`, direct import entry points reject and require C-11 administrative unlock — no silent bypass.
- No PDF/DOCX/XLSX handling here (C-05); no draw, persistence, broadcast, or CSV-export changes.
- Tests: separators, header, numbering, diacritics, dedupe, empty list, title-only, locked rejects direct import.

## Capabilities

### New Capabilities
- `import-catalog`: offline catalog load path — line normalization, text/CSV/TSV parsing, normalized dedupe with visible counts, 12-song demo seed, list-review surface, and locked-session rejection. Covers US-002, US-003, US-004; RN-IMP-01…04 at offline-path level.

### Modified Capabilities
- None. `session-models` (Song shape, `locked` default) and `app-structure` (file layout, `js/import.js` seam) are consumed, not changed; this change only fills the import seam they already reference.

## Impact

- Affected code: `js/import.js` (+ `js/app.js` wiring for `sampleBtn`/paste handlers and locked guards) and `tests/import.test.js` (+ `tests.html` mirror) — no `core.js`/`draw.js`/`store.js`/`public.js` logic changes.
- APIs: `MBDJ.import {normalizeLine, parseText, dedupe, importSongs}` signatures preserved; `importSongs` return `{added, duplicates, message}` contract frozen; locked rejection surfaces as blocked message (exact UI string settled in design).
- Dependencies/systems: none — offline-first, no bundler, no modules, no CDN, no storage writes (C-06 persists the resulting list; C-11 owns the unlock flow).
- Breaking: none.
