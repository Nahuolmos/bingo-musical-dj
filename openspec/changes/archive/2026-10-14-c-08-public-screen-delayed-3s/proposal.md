# Proposal

## Why

C-07 froze the game rule (commit-before-render + `locked` on first draw) but the live show still spoils: `handleDrawClick` broadcasts the committed title immediately while the operator wheel spins 2750 ms, so the projector reveals ~2.75 s early (RN-PUB-03 / IN-03). The DJ also has no buffer to find and cue the track in VirtualDJ manual. C-08 closes GATE 4's show fork by delaying the public reveal ~3 s after the operator spin ends, keeping the commit intact.

## What Changes

- Two-phase public reveal with `REVEAL_DELAY_MS = 3000` (named, exported, testable): at commit emit only `{phase:'spinning'}` with NO title/artist to both screens (wheels spin); the `{phase:'reveal', title, artist}` broadcast fires ~3000 ms AFTER the operator spin ends (`SPIN_MS=2750` from C-03/C-07 untouched), giving manual VirtualDJ cue time. Commit-before-render preserved: `pickAndCommit` still decides synchronously; only the *render/broadcast* of the title is delayed.
- `public.html` standalone (no `document.write`): opened via `window.open('public.html','musicBingoPublic','popup,…')`; refocus if already open; `setTimeout(broadcast, 250)` re-sync on open; blocked-popup alert; `BroadcastChannel` absent → require Chrome/Edge actualizado. Keeps `file://` localStorage mirror + `storage`-event fallback from current `public.js`/`app.js`.
- Public screen read-only contract: ruleta + giant title/artist, counter `Disponibles: N · Sorteadas: M`, last-5 pills, no private controls; intermediate message `Buscando el tema en cabina…` during spin + 3 s buffer; `esc()` on all rendered strings.
- Buffer-aware guards: draw + played/void confirm stay disabled during spin AND the 3 s buffer; clear/reset cancel both the spin timer (C-03 `cancelReveal`) and the pending public reveal (no ghost reveals).
- Tests: no title on pública during `spinning` nor during the 3 s buffer; reveal syncs after delay (±250 ms tolerance); no private controls; popup-blocked path alerts; `REVEAL_DELAY_MS` tunable without breaking the prior commit.

## Capabilities

### New Capabilities

- `public-screen`: delayed two-phase public reveal (spinning-without-title → timed reveal), standalone popup lifecycle, read-only projector contract, and buffer-aware guards — the delayed-show layer over the C-03 engine + C-07 commit.

### Modified Capabilities

- None. `draw-engine` (`SPIN_MS`, cancellable timer, commit marker), `draw-no-repeat` (commit/lock/edges), `session-models` (Song/HistoryEntry/Session), `session-persistence` (autosave/banner) are consumed as-is; this change adds requirements only to the new capability.

## Impact

- Code: `js/app.js` (`handleDrawClick` two-phase broadcast, `openPublic` rewired to `public.html`, buffer disables, cancel-on-clear/reset extended); `js/public.js` + `public.html` (phase renderer: spinning vs reveal vs idle, counter, last-5, intermediate message); `js/draw.js` timer seam reused (second handle or chained schedule for the buffer — detail in design.md; `SPIN_MS` never merged with `REVEAL_DELAY_MS`).
- Tests: `tests/public.test.js` (new) + E2E double-page sync + `file://` smoke pre-show; `node --test` zero-installs, `cmd /c` on Windows.
- Docs: IN-03 resolved; `docs/PRE_SHOW_CHECKLIST.md` gains projector + popup + offline-buffer check.
- Out of scope: motivo/void persistence (C-09), CSV export (C-10), admin unlock (C-11), file/excel/pdf import (C-05). No VirtualDJ automation claim — manual cue only (DD-01).
