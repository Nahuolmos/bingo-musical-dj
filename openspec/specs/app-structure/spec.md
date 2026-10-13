# app-structure Specification

## Purpose

Defines the portable multi-file layout that replaces the single-file monolith while preserving identical visible behavior and double-click opening.

## Requirements

### Requirement: Operator entrypoint opens by double-click

The system SHALL provide a thin `index.html` operator entrypoint that opens via `file://` double-click in Chrome/Edge with no build step, no server, and no bundler.

#### Scenario: Double-click opens operator panel

- **WHEN** the operator double-clicks `index.html` with no server running
- **THEN** the operator panel loads with list, draw controls, history, and import UI visible and functional

#### Scenario: No bare module syntax on main path

- **WHEN** the entrypoints declare their scripts
- **THEN** they use classic `<script>` tags in documented load order and SHALL NOT use bare `type="module"` on the main path

### Requirement: Public screen is standalone without document.write

The system SHALL provide a standalone `public.html` that renders the public view without `document.write` and opens via `window.open('public.html', …)` with popup-block fallback messaging.

#### Scenario: Public screen opens standalone

- **WHEN** the operator triggers "Abrir pantalla pública" and popups are allowed
- **THEN** `public.html` opens as an independent readable screen showing wheel, current title/artist area, counters, and last-5 list

#### Scenario: Blocked popup warns operator

- **WHEN** the browser blocks the public window
- **THEN** the operator sees a message explaining how to allow popups for the file and retry

### Requirement: Styles extracted verbatim with no visual regression

The system SHALL extract all operator and public styles into `css/styles.css` verbatim, producing no visual change versus the monolith for operator and public screens.

#### Scenario: Visual parity after split

- **WHEN** the operator compares monolith `index.html` against split `index.html` + `public.html` side by side
- **THEN** layout, colors, typography, and wheel/result states are indistinguishable

### Requirement: JavaScript split into load-ordered classic scripts

The system SHALL split behavior into `js/core.js`, `js/import.js`, `js/draw.js`, `js/store.js`, `js/public.js`, `js/app.js` loaded by classic `<script>` tags in documented order, each loadable in a browser via `file://` and importable under Node for tests.

#### Scenario: Ordered classic-script load

- **WHEN** `index.html` loads its scripts in the documented order
- **THEN** operator bootstrap initializes without CORS errors, missing globals, or console errors

#### Scenario: Modules load under Node

- **WHEN** the test runner imports each `js/*.js` under Node
- **THEN** every module loads without `window`/`document` hard-crash at import time (browser-only wiring deferred to bootstrap)

### Requirement: Monolith preserved until parity passes

The system SHALL keep the original `index.html` monolith as read-only behavior reference with a migration checklist (audited functions and IN-01…IN-07 gaps); nothing is deleted until the multi-file build passes all harness tests.

#### Scenario: Audit gates deletion

- **WHEN** the migration checklist shows any failing load or visual-regression test
- **THEN** the monolith remains the fallback reference and no source file is removed

### Requirement: Demo asset and pre-show docs ship with foundation

The system SHALL ship anonymized `assets/lista-ejemplo.csv` (12 demo rows covering `,`/`;`/tab separators and `Artista - Titulo` lines) plus initial `docs/PRE_SHOW_CHECKLIST.md` (projector, popups, VDJ-manual audio, offline drill, pre-export) and `docs/ESTRUCTURA.md` (file map + script load order).

#### Scenario: Demo asset loads offline

- **WHEN** the operator imports `assets/lista-ejemplo.csv` with no internet
- **THEN** 12 songs appear in the list with no duplicates and no silent discards

#### Scenario: Docs describe structure and drill

- **WHEN** a new operator reads `docs/ESTRUCTURA.md` and `docs/PRE_SHOW_CHECKLIST.md`
- **THEN** they can locate every entrypoint/module and execute the offline drill steps without extra guidance
