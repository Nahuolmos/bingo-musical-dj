# Design

## Context

See proposal.md (Why) and `specs/public-screen/spec.md` (contract). Current state (verified in repo): `js/app.js` `handleDrawClick` commits via `draw.pickAndCommit()`, broadcasts the full `current` (with title) immediately, then `draw.scheduleReveal(cb, SPIN_MS=2750)` reveals the operator title. `buildStateMessage()` always includes `current{title,artist,status}` — hence the RN-PUB-03 spoiler. `js/public.js` `summarizeState`/`buildPublicHTML` renders whatever `current` arrives; `file://` needs the `localStorage` mirror (`writeTransport` + `storage` event + hydrate) because `BroadcastChannel` alone does not deliver between two `file://` pages. `js/draw.js` owns one cancellable spin timer (`revealTimer` + injectable `setTimerFns`) with the rule "never merge the C-08 buffer into `SPIN_MS`". Constraints: classic `<script>` order, `file://` portable, Node-safe, `node --test` zero-installs, `cmd /c` on Windows; governance MEDIUM, plan-only.

## Goals / Non-Goals

**Goals:**

- Phased envelope (`spinning` without title → `reveal` with title) over the existing BC + `localStorage`-mirror transport, with the operator title visible at spin end and the public title ~3000 ms later.
- Buffer ownership + cancellation such that clear/reset mid-spin or mid-buffer leaves no ghost reveal on either screen.
- Read-only projector renderer keyed strictly off the phase, with the cabin-search intermediate message and escaped strings.

**Non-Goals:**

- No `SPIN_MS` change, no `pickAndCommit`/commit-order change (C-03/C-07 frozen), no `motivo`/void change (C-09), no CSV change (C-10), no admin-unlock change (C-11). No VirtualDJ automation (manual cue only, DD-01).

## Decisions

1. **Phased envelope: `{type:'state', phase, current-or-null, …counts/history}`.** At commit, `handleDrawClick` broadcasts `{phase:'spinning', current:null}` (title withheld by construction, not by renderer discipline); at operator spin end it keeps broadcasting `spinning` (operator wheel already shows its own title locally — that DOM render is operator-only, never broadcast); after the buffer it broadcasts `{phase:'reveal', current:{title,artist,status}}`. Idle stays `{phase:'idle'}`. Rationale: the spoiler is closed at the sender, so even an old/stale public renderer cannot leak the title. Alternative (send title always, let pública hide it until a timer) rejected — reintroduces the leak on any renderer desync and duplicates timing in two places.
2. **Buffer timer owned by `app.js`, spin timer stays in `draw.js`.** New `REVEAL_DELAY_MS = 3000` + `publicRevealTimer` handle in `app.js`, reusing the `draw.js` injectable-timer pattern (`setTimeoutFn`/`clearTimeoutFn` seam) so tests drive both timers deterministically. Chain: spin `scheduleReveal(SPIN_MS)` → operator local reveal + keep broadcasting `spinning` → `schedulePublicReveal(REVEAL_DELAY_MS)` → broadcast `reveal` + `render()`. Rationale: honors the C-03 invariant "never merge the buffer into `SPIN_MS`"; each timer has a single owner, both cancelled together. Alternative (second handle inside `draw.js`) rejected — drags public-screen policy into the secure engine and widens C-03's blast radius.
3. **Asymmetric reveal is intentional: operator sees the title at spin end, pública 3 s later.** The operator must read the title to search/cue in VirtualDJ manual during the buffer; the pública shows `Buscando el tema en cabina…` + spinning wheel + counters/last-5 in the meantime. Alternative (hide from both until buffer end) rejected — the DJ cannot cue what they cannot read, defeating the buffer's purpose.
4. **Guards via `isPublicBuffer()` OR-ed with `spinning`.** `render()` computes `drawBtn.disabled = !av.length || spinning || bufferPending`; `confirmBtn`/`skipResult` likewise blocked; `setCurrentStatus` early-returns while either flag is set (C-09 consumes this: confirm only enabled post-reveal). Rationale: single predicate both screens' logic can share; C-09's "sin giro ni buffer pendiente" precondition falls out for free. Alternative (separate disabled paths per button) rejected — drifts out of sync.
5. **Cancel both timers on clear/reset, then `finishCommit`.** `handleClearSongs`/`handleResetAll` call `draw.cancelReveal()` + `cancelPublicReveal()` + `finishCommit()` before wiping state (confirm modals stay synchronous first, as in C-03). Rationale: a mid-buffer clear otherwise resurrects the committed title on the projector after the wipe. Alternative (cancel spin only) rejected — exactly the ghost-reveal class C-03 fixed, shifted 3 s later.
6. **`public.html` standalone renderer keyed off `phase` only.** Listens to `BroadcastChannel('music-bingo-dj-on')` + `storage` event on `TRANSPORT_KEY` + hydrate-on-load (same triple as today); renders: `spinning` → wheel spin + cabin message + counters/last-5, never `current`; `reveal` → giant escaped title/artist + counters/last-5; `idle` → `¡Preparados para jugar!`. `openPublic` keeps `window.open('public.html','musicBingoPublic','popup,…')` + refocus + `setTimeout(broadcast, 250)` + blocked-popup alert. Rationale: `file://` opaque-origin fix is preserved verbatim; phase-keying makes stale full-state messages harmless. Alternative (`document.write` injection as in the old Flujo 4) rejected — violates the C-01/C-08 standalone constraint.

## Risks / Trade-offs

- [Risk] Operator/pública visibly diverge for 3 s (operator title vs pública cabin message) → Mitigation: that is the specified behavior; cabin message + same wheel motion make the divergence legible, not contradictory (RN-PUB-02 pinned by counter/last-5 equality test).
- [Risk] `localStorage` mirror + BC double-delivery renders twice → Mitigation: renderer is idempotent off `(phase, current.id)`; dedupe key on last-applied `(phase+n)`; tests post the same envelope twice and assert one render.
- [Risk] Crash mid-buffer strands pública on `spinning` forever → Mitigation: reopen/`setTimeout(broadcast,250)` re-syncs; refresh restores via C-06 banner path (state has `current drawn`, phase recomputed as `idle`-with-current → operator re-reveals, pública follows on next broadcast); documented in pre-show checklist, not silent.
- [Risk] Fixed 3000 ms too short/long for a real cabin → Mitigation: single named constant, tunable in one line; tolerance test (±250 ms) pins timing without freezing future tuning; no UI setting in v1 (keeps show controls big/simple per RN-X-04).
- [Risk] C-09/C-10 reading `current` during the buffer (confirm/CSV) → Mitigation: `current` exists from commit (unchanged), but confirm is gated on buffer end and history gains exactly one entry at commit — C-10's "one row per draw, no duplicates" holds; noted as interface contract for C-09/C-10.

## Migration Plan

Pure in-place change, no data migration: `app.js` gains phase envelope + buffer handle + guards; `public.js`/`public.html` gain phase renderer; `draw.js` untouched except reusing its timer-seam pattern. `schemaVersion` unchanged. Rollback = revert three files. Verify with `cmd /c "node --test tests/public.test.js"` + `cmd /c "node --test tests/"` + two-page E2E (spin → no title → buffer message → reveal ±250 ms) + `file://` smoke (popup, projector move, offline, refresh re-sync) + `cmd /c "openspec validate c-08-public-screen-delayed-3s"` (positional name).

## Open Questions

- None blocking. If the cabin later needs a tunable delay UI, that is a follow-up change (constant → setting + persistence); specs already isolate the constant so the change stays mechanical.
