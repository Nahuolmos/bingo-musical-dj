# Proposal: c-15-instant-result-word-scroll

## Why

The operator spin (~2750 ms) delays the DJ's VirtualDJ cue for no show value — the result is already committed before the animation (RN-SOR-02) — while the public screen sits on a static cabin message during its buffer. Removing the operator spin gives the DJ the title+artist instantly (with copy available), and filling the public 5 s buffer with a word-scrolling teaser of remaining songs keeps the projector alive without spoiling the result.

## What Changes

- **Dashboard sin ruleta**: `handleDrawClick` commits via `pickAndCommit()` and renders the result immediately (title+artist visible + copy available). No operator spin animation, no ~2750 ms operator timeout.
- **Commit-before-show preserved**: `secureIndex` commit (status + current + history + lock) still happens synchronously before any render or broadcast (RN-SOR-02 unchanged).
- **Operator spin machinery removed**: `SPIN_MS` (draw.js), `scheduleReveal`/`cancelReveal`/`isRevealing` operator path, and the `spinning`-phase operator wheel texts (`SORTEANDO`) are retired where they only served the operator giro. `spinning` as commit flag may be reduced to a transient or removed if no guard needs it (see design open question).
- **Pública conserva delay pero de 5 s**: `REVEAL_DELAY_MS` 3000 → 5000 (single named constant, still independent of any spin base). All tests/scenarios asserting 3000 retuned with redefined tolerance.
- **Word-scrolling en buffer público**: during the 5 s buffer the public screen vertically scrolls names of REMAINING songs (available pool snapshot carried in the `spinning`-phase message) and closes with the real title reveal at 5 s. Scroll EXCLUDES the drawn song (anti-spoiler) and reveals nothing early.
- **Bloqueo durante buffer**: Sortear + Confirmar (played/void, coherent with C-09) stay disabled while the 5 s public buffer is pending; enabled at reveal. No overlapping/pisados reveals (single buffer owner). Vaciar/Reiniciar cancel the buffer (extends C-03/C-11 guards).
- **Offline/file:// intactos**: scroll data travels in-memory via the existing `BroadcastChannel` + `localStorage` mirror message (payload extended with remaining titles); zero network, classic `<script>`, system-first fonts.

## Capabilities

### New Capabilities

(none — behavior changes attach to existing capabilities)

### Modified Capabilities

- `draw-no-repeat`: instant operator result (no spin), commit-before-show kept, draw/confirm lock re-scoped from spin to public-buffer window, spin-timeout cancellation retired with the spin.
- `public-screen`: 5 s named delay, word-scroll buffer phase fed by remaining-titles payload (drawn excluded), buffer-aware guards + clear/reset cancellation extended to the scroll window.
- `draw-engine` (opción A, Q1 resuelta): operator spin machinery + 2750 ms spin base retired (instant dashboard result post-commit); cancellable-handle guards retained re-keyed to the 5 s public buffer, coherent with C-03/C-11.

## Impact

- Code: `js/draw.js` (retire operator `SPIN_MS`/reveal-handle path; `pickAndCommit`/`finishCommit` kept), `js/app.js` (`handleDrawClick` immediate render, `buildStateMessage` spinning envelope extended with remaining-titles payload, `REVEAL_DELAY_MS=5000`, buffer guards kept), `js/public.js` + `public.html` (scroll renderer + reveal close, payload parsing, escaping), inline CSS (scroll animation, `prefers-reduced-motion` fallback).
- Specs: `draw-no-repeat` (6 reqs), `public-screen` (6 C-08 + 4 C-14, incl. the 3000 ms + tolerance scenarios), `draw-engine` (2 reqs MODIFIED: spin-base/timeout + spin guard, títulos originales retenidos).
- Tests: suite 268/268 — every 3000 ms assertion retuned to 5000; new anti-spoiler scroll test mandatory; timing tolerance redefined (see design § timing).
- No-ops: `confirm-void` (guards unchanged in meaning), `history-export`, `session-lock` (lock semantics unchanged); VirtualDJ stays manual; offline/smoke `file://` unaffected.
