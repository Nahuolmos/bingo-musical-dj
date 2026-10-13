# Design — c-01-foundation-multifile

## Context

See proposal.md (Why). Current state: single `index.html` (29 957 bytes) mixing `<style>`, operator markup, `publicHTML()` template string + `document.write` popup (`openPublic` handler), and one inline `<script>` with ~20 top-level units (`$`, `esc`, `normalizeLine`, `makeId`, `parseText`, `dedupe`, `available`, `broadcast`, `render`, `setMessage`, `importSongs`, biased `draw()` + `secureIndex()` + rebound secure draw handler, `setCurrentStatus`, `publicHTML`, `loadScript`, `sampleBtn`/`exportLog`/`fileInput` wiring, `copyResult`/`skipResult` handlers). No `openspec/specs/*` exist; no `tests/`, `css/`, `js/`, `public.html`. Constraints: `file://` double-click in Chrome/Edge, offline-first main path, no bundler, no bare `type="module"` (CORS), AGENTS.md hard rules 1–2.

## Goals / Non-Goals

**Goals:**

- Produce a multi-file tree that opens by double-click and renders identically to the monolith (operator + public).
- Establish deterministic classic-`<script>` load order and a `docs/ESTRUCTURA.md` contract later changes (C-02…C-06) can build on.
- Ship a zero-install harness (Node `--test` + `tests.html`) that imports split modules, not the monolith.
- Inventory IN-01…IN-07 as a migration checklist before touching behavior.

**Non-Goals:**

- No behavior change to draw/import/broadcast/persistence semantics (C-02…C-06 own those).
- No `REVEAL_DELAY_MS`, no `locked`, no `motivo`, no autosave — stubs/placeholders only where load order requires them.
- No visual redesign, no theming, no VirtualDJ integration, no `.xlsx` vendor decision (C-05/C-08/C-11/C-13).

## Decisions

### 1. Classic `<script>` tags in fixed order (over `type="module"` / bundler)

`index.html` loads `js/core.js → js/import.js → js/draw.js → js/store.js → js/public.js → js/app.js`; `public.html` loads `js/public.js` (+ minimal bootstrap). Alternative `type="module"` rejected: bare module imports fail under `file://` via CORS. Alternative bundler rejected: violates no-build portable constraint and adds toolchain days before the event. Each `js/*.js` attaches to shared globals (documented in `ESTRUCTURA.md`) and defers `document` access so Node import does not crash — browser-only wiring lives in `app.js`/`public.js` bootstrap.

### 2. Verbatim CSS extraction (over rewrite)

`css/styles.css` is byte-identical extraction of the current `<style>` block; `index.html`/`public.html` link it with no edits. Alternative (cleanup/rewrite) rejected: any visual drift breaks the no-regression gate and wastes review. Public-specific rules stay in the same file for C-01 (split later only if C-08 needs it).

### 3. Standalone `public.html` file (over `document.write` template)

`publicHTML()` string becomes a real `public.html` document with identical markup/styles; `openPublic` becomes `window.open('public.html','musicBingoPublic',…)` + `setTimeout(broadcast,250)` + blocked-popup alert (same UX, new target). `document.write`/`document.open` path removed from the split build. Alternative (keep generating via JS) rejected: harder to test by double-click, harder to diff visually.

### 4. `js/store.js` as load-order stub (over full persistence now)

`store.js` exposes the persistence seam (`save`/`load`/`clear` no-ops or in-memory) so `app.js` load order is final; C-06 fills it with `localStorage mbdj.v1` autosave + banner + `beforeunload`. Alternative (implement persistence in C-01) rejected: expands scope past GATE 0 and collides with C-02 schema (`locked`/`schemaVersion`).

### 5. Harness: Node `--test` + `tests.html` mirror (over Vitest/Jest + Testing Library)

Registry defaults (Vitest/Jest, Testing Library) are overridden by the no-build constraint: zero `npm install`, runnable on the event machine. `tests/*.test.js` use `node:test` + `node:assert/strict`; `tests.html` mirrors the same assertions with a minimal inline runner for double-click. Mocks for WebCrypto/`localStorage`/`BroadcastChannel` per `javascript-testing-patterns` apply from C-02 on; C-01 only asserts load + parity. TDD applies as: one seam (one `js/*.js` load / one parity check) → failing test → minimal extraction → green.

### 6. Lowercase change dir `c-01-foundation-multifile` (over `C-01-…`)

CLI rejects uppercase (`Change name must be lowercase`). `CHANGES.md` keeps `C-01` display ID; the OpenSpec dir uses the lowercase form and references the display ID in prose.

## Risks / Trade-offs

- [Risk] Verbatim extraction drift (whitespace/encoding, BOM in CSV export path) → Mitigation: diff `<style>` vs `css/styles.css` + side-by-side visual check in harness.
- [Risk] Global-namespace collisions between split scripts → Mitigation: single ownership per global documented in `ESTRUCTURA.md`; harness fails on duplicate-definition warnings.
- [Risk] `file://` quirks differ between Chrome/Edge versions → Mitigation: smoke both browsers in `PRE_SHOW_CHECKLIST.md`; `npx serve` documented as fallback only.
- [Risk] `tests.html` mirror diverges from `tests/*.test.js` → Mitigation: mirror imports the same assertion list; tasks require editing both in the same step.
- [Trade-off] Stubs (`store.js`) add a temporary no-op layer → accepted; removed-by-fill in C-06, tracked as explicit task.

## Migration Plan

1. Read-only audit of monolith (function inventory + IN-01…IN-07 checklist) — no writes outside `openspec/`.
2. Scaffold `css/`, `js/`, `tests/`, `assets/`, `docs/` + `public.html` + `tests.html`; extract verbatim.
3. Run `node --test tests/` + double-click `tests.html` + double-click `index.html`/`public.html` visual compare.
4. Only when all green: monolith demoted to reference (no deletion in C-01 — deletion, if ever, is a later change). Rollback = keep opening the monolith file; split files are additive.

## Open Questions

- None blocking. Deferred (owned by later changes, do not alter this design): `.xlsx` vendor-vs-CSV procedure (C-05), `REVEAL_DELAY_MS` value/placement (C-08), `localStorage` vs IndexedDB (C-06), `locked` admin flow (C-11).
