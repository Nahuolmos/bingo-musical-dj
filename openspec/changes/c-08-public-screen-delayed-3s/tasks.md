# Tasks

## 1. Phased envelope + named delay (RED→GREEN)

- [x] 1.1 RED: add failing phase tests in `tests/public.test.js` (commit broadcasts `{phase:'spinning'}` with `current:null` — no title/artist on the wire; `REVEAL_DELAY_MS` single named export `=== 3000` and distinct from `SPIN_MS`; reveal envelope `{phase:'reveal'}` carries the committed title) with AAA + `beforeEach` fresh state + injected timer seam, and verify failure via `cmd /c "node --test tests/public.test.js"`
- [x] 1.2 GREEN: implement the phased envelope in `js/app.js` (`buildStateMessage(phase)`, `REVEAL_DELAY_MS = 3000` exported via `MBDJ.app`, spin-end chains the buffer timer reusing the `draw.js` injectable-timer pattern, commit path untouched) and verify 1.1 plus no C-03/C-07 regressions via `cmd /c "node --test tests/public.test.js"`
- [x] 1.3 Add timing tests (public reveal fires only after `SPIN_MS + REVEAL_DELAY_MS` via injected timers; lands within ±250 ms of the configured delay in the E2E clock; retuning the constant moves the reveal without touching commit/spin) and verify via `cmd /c "node --test tests/public.test.js"`

## 2. Public renderer + popup lifecycle (RED→GREEN)

- [x] 2.1 RED: add failing renderer tests (spinning phase renders wheel + `Buscando el tema en cabina…` with no committed title; reveal phase renders giant escaped title/artist; idle renders `¡Preparados para jugar!`; counter + last-5 match operator snapshot; markup in title/artist renders inert) and verify failure via `cmd /c "node --test tests/public.test.js"`
- [x] 2.2 GREEN: implement the phase-keyed renderer in `js/public.js` + `public.html` (BC + `storage`-event + hydrate-on-load triple preserved, `esc()` on all strings, idempotent re-render off `(phase, current.id)`, double-delivery dedupe) and verify 2.1 passes via `cmd /c "node --test tests/public.test.js"`
- [x] 2.3 Add popup-lifecycle tests (open uses `window.open('public.html','musicBingoPublic','popup,…')` + `setTimeout(broadcast, 250)`; reopen refocuses without a second window; blocked popup returns `{blocked:true}` + alert copy; `BroadcastChannel` absent requires Chrome/Edge) with mocked `window.open`/`alert` boundaries only, and verify via `cmd /c "node --test tests/public.test.js"`

## 3. Buffer guards + dual cancellation (RED→GREEN)

- [x] 3.1 RED: add failing guard tests (draw + played/void confirm no-op during spin AND during the 3 s buffer; `render()` disables `drawBtn`/`confirmBtn` through both; `setCurrentStatus` early-returns mid-buffer; history still exactly one entry per draw after the delayed reveal) and verify failure via `cmd /c "node --test tests/public.test.js"`
- [x] 3.2 GREEN: implement `isPublicBuffer()`/`cancelPublicReveal()` in `js/app.js` (OR-ed with `spinning` in `render()` + `handleDrawClick` + `setCurrentStatus`; clear/reset cancel spin timer + buffer timer + `finishCommit` after the synchronous confirms) and verify 3.1 plus full draw suite via `cmd /c "node --test tests/"`
- [x] 3.3 Add ghost-reveal tests (clear mid-spin, clear mid-buffer, reset mid-spin, reset mid-buffer → neither operator nor public reveal fires afterward) via the injected timer seam and verify via `cmd /c "node --test tests/public.test.js"`

## 4. E2E double-screen + pre-show verification

- [x] 4.1 Add multi-context E2E (two pages/contexts, `data-testid` locators, web-first assertions, clock-mocked timers): spin → pública shows no title → buffer shows cabin message → reveal syncs on both with equal counter/last-5, and verify via the project's Playwright runner
- [x] 4.2 Run full suite `cmd /c "node --test tests/"` plus `file://` smoke in Chrome/Edge (open pública → move to projector → demo → sortear → buffer message → reveal → confirm → refresh re-syncs via C-06 banner → popup-blocked path) and verify all green with no C-03/C-04/C-06/C-07 regressions
- [x] 4.3 Update `docs/PRE_SHOW_CHECKLIST.md` (projector + popup-allow + offline buffer + refresh re-sync checks) and verify the documented checks run as written; run `cmd /c "openspec validate c-08-public-screen-delayed-3s"` (positional name) and verify planning artifacts complete

## Workflow follow-up

- Apply the change separately once confirmed (governance MEDIUM); then archive with `/opsx:archive c-08-public-screen-delayed-3s`.
