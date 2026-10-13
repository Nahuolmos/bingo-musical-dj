# Proposal

## Why

`js/draw.js` + `js/app.js` still carry the IN-04 risks: a biased modulo `draw()` legacy path confuses the single secure algorithm, and the 2750 ms reveal `setTimeout` in `handleDrawClick` is uncancellable, so Vaciar/Reiniciar mid-giro leaves a ghost reveal that resurrects an already-deleted result (RN-SOR-06). C-03 closes IN-04 before C-07 builds the no-repetition commit on top of it.

## What Changes

- Remove any executable biased-modulo `draw()` path; `secureIndex(n)` with rejection sampling over `crypto.getRandomValues` becomes the single random engine in `js/draw.js` (legacy bias kept only as a commented audit note).
- Store the reveal `setTimeout` in a cancellable handle (`revealTimer` + `scheduleReveal`/`cancelReveal`); `Vaciar lista` / `Reiniciar` cancel it so no ghost reveal fires mid-giro.
- Freeze the spin base duration as a named, testable constant (`SPIN_MS = 2750`); the C-08 VirtualDJ buffer (`REVEAL_DELAY_MS = 3000`) stays separate and is NOT mixed into this change.
- Add an explicit commit-before-render audit comment at the commit site (RN-SOR-02).
- Tests (node:test + assert/strict, zero installs): chi-square uniformity of `secureIndex`, absence of modulo bias vs independent literals, cancellation on vaciado/reinicio, spinning guard blocking draw and confirm.

## Capabilities

### New Capabilities

- `draw-engine`: single secure random engine (`secureIndex`), cancellable reveal timeout (`SPIN_MS = 2750`), commit-before-render audit marker, and spinning guard contract consumed by C-07/C-08/C-11.

### Modified Capabilities

- None. `session-models` (`spinning`, `locked`, transitions) is consumed as-is; this change adds no requirement to it.

## Impact

- Code: `js/draw.js` (engine + timer handle + constant + audit comment), `js/app.js` (`handleDrawClick`, `clearSongs`, `resetAll` call `cancelReveal`; reveal uses `SPIN_MS`).
- Tests: `tests/draw.test.js` extended (uniformity, bias absence, cancellation, spinning guard); no new harness.
- Docs: none beyond code comment; C-08 owns the separate 3 s buffer, C-07 owns lock activation, C-11 owns admin unlock.
- Out of scope: no repetition logic (C-07), no public-screen delay (C-08), no motivo/void (C-09), no persistence (C-06), no import guards (C-04/C-05).
