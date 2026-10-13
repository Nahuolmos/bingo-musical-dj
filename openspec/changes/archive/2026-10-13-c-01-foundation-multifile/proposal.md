# Proposal — c-01-foundation-multifile

## Why

`index.html` (~30 KB single-file) is the only executable artifact and the bottleneck for every later change: it mixes operator panel, public-screen template (`publicHTML()` + `document.write`), styles, and all domain logic (`normalizeLine`, `parseText`, `dedupe`, `draw`/`secureIndex`, `broadcast`, `render`) in one file. Any parallel work (C-02 models, C-03 draw, C-04 import) would collide on it, and no portable test harness can import it. C-01 unlocks GATE 0 → C-02 by producing a portable multi-file foundation with identical behavior.

## What Changes

- Split `index.html` (read-only reference; nothing deleted until multi-file passes tests) into portable multi-file structure:
  - `index.html` (thin operator entrypoint) + `public.html` (standalone public screen, no `document.write`).
  - `css/styles.css` (extracted verbatim from current `<style>`, no visual change).
  - `js/core.js` (Session/Song/HistoryEntry shapes) + `js/import.js` (`normalizeLine`, `parseText`, `dedupe`) + `js/draw.js` (`secureIndex`, commit) + `js/store.js` (persistence stub, implemented in C-06) + `js/public.js` (public render) + `js/app.js` (operator bootstrap, script load order).
- Portable constraint enforced: NO bundler, NO bare `type="module"` (breaks `file://` via CORS); classic `<script>` tags in load order. Everything opens by double-click in Chrome/Edge.
- Read-only audit of `index.html` first: inventory of functions (`normalizeLine`, `parseText`, `dedupe`, `available`, `draw`, `secureIndex`, `setCurrentStatus`, `broadcast`, `publicHTML`, `openPublic` handler) and IN-01…IN-07 gaps as migration checklist.
- Portable harness: `tests/` with no-build runner (`tests/*.test.js` runnable with Node `--test` + mirror `tests.html` openable by double-click) importing the split `js/*.js` (not the monolith).
- `assets/lista-ejemplo.csv` anonymized (12 demo rows covering `,`/`;`/tab + `Artista - Titulo`); initial `docs/PRE_SHOW_CHECKLIST.md` (projector, popups, audio/VDJ manual, offline test, pre-export).
- `docs/ESTRUCTURA.md` documenting the split and load order.

## Capabilities

### New Capabilities

- `app-structure`: portable multi-file layout — thin entrypoints, verbatim CSS extraction, classic-script `js/*.js` modules, standalone `public.html` without `document.write`, all openable via `file://` double-click with no visual regression vs. monolith.
- `portable-harness`: no-build test harness — `tests/*.test.js` under Node `--test` plus `tests.html` mirror for double-click, importing split `js/*.js`; per-module load checks (browser + Node) and visual no-regression checks.

### Modified Capabilities

- None. This change is behavior-preserving scaffolding; no existing spec requirements change (no specs exist yet — `openspec list --specs` returns zero).

## Impact

- Affected: `index.html` (audit only, reference for behavior parity — not deleted/rewritten in place); new files `public.html`, `css/styles.css`, `js/{core,import,draw,store,public,app}.js`, `tests/*`, `tests.html`, `assets/lista-ejemplo.csv`, `docs/ESTRUCTURA.md`, `docs/PRE_SHOW_CHECKLIST.md`.
- No API/backend/dependency changes; no CDN added to main path; no behavior change to draw/import/broadcast semantics (deferred to C-02…C-06).
- Risk: extraction drift (CSS/JS verbatim) — mitigated by no-regression tests (double-click + Node) before any deletion.
