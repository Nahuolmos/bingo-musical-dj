# Design: c-15-instant-result-word-scroll

## Context

See proposal.md for motivation. Current state: `pickAndCommit()` (js/draw.js) commits synchronously then sets `spinning=true`; `handleDrawClick()` (js/app.js) runs the operator wheel animation and a `draw.js` reveal timer (`SPIN_MS=2750`), then a second `app.js` buffer timer (`REVEAL_DELAY_MS=3000`, injectable for tests) before `broadcast('reveal')`. The public screen (public.html + js/public.js `buildPublicHTML`, kept identical by convention) shows a static cabin message during both windows. Suite is 268/268; every 3000 ms assertion must move to 5000.

## Goals / Non-Goals

**Goals:**
- Dashboard shows title+artist+copy the instant the commit lands, with zero operator animation or operator timer.
- Public buffer becomes a 5 s word-scrolling teaser over remaining songs, closing with the real reveal, spoiler-free by construction.
- Single buffer owner, no overlapping reveals, clear/reset cancel the buffer, draw+confirm locked through it.
- Offline/file:// unchanged: payload rides the existing `BroadcastChannel` + `localStorage` mirror message.

**Non-Goals:**
- No VirtualDJ integration change (still manual); no catalog-size pagination; no new persisted schema (scroll payload is transient wire data, never saved to `mbdj.v1`); no font/asset additions on the public path.

## Decisions

### 1. Retire the operator spin path, keep `pickAndCommit` as the single commit

`pickAndCommit()` keeps doing exactly what it does today (uniform `secureIndex`, status + current + history + `locked=true`) but no longer sets `spinning=true` — there is no operator window left to guard. `handleDrawClick()` becomes commit → immediate dashboard paint (result panel + copy) → `broadcast('spinning')` → `schedulePublicReveal(reveal, 5000)`.
Alternative considered: keep a zero-duration spin flag for compat — rejected, it would leave dead guard branches and a stale `SORTEANDO` copy path.
`finishCommit`, `scheduleReveal`/`cancelReveal`, `SPIN_MS` in draw.js are deleted with the path that owned them; `isPublicBuffer()` in app.js becomes the single pending predicate. The dormant `state.spinning` field stays at its default `false` (boot/persist lines untouched) to keep the diff surgical; a full purge is cleanup-fodder, not this change.

### 2. Scroll payload rides the spinning-phase envelope, spoiler-free by construction

`buildStateMessage('spinning')` gains `scrollPool: [{id, title, artist}]` built from `core.available()` AFTER the commit — the drawn song already left the eligible pool, so exclusion is structural, not filter-based. The test additionally asserts exclusion by id (covers title collisions: another remaining song may share the title text, the drawn id must still be absent).
Alternative considered: public derives the pool from `songs` minus history — rejected, the spinning envelope deliberately scrubs drawn rows, so the public cannot reconstruct the pool itself; sending the snapshot is the only offline-safe option.
Volume: event catalogs (tens to low hundreds of short titles) serialize to a few KB — far below `localStorage` limits; no cap in v1.

### 3. JS ticker, not CSS marquee

The public buffer renders a fixed-height window with one title at a time stepping vertically (~500 ms/step via the existing injectable-timer pattern) with a CSS `transform` transition for the slide effect. Rationale: deterministic under tests, trivially pausable at reveal, honors `prefers-reduced-motion` (static neutral cabin text, no title), and every scrolled string passes through the existing `esc()` path.
Pure seams in `js/public.js` (exported, Node-testable): `pickScrollItems(pool, drawnId)` and the step/reduce logic; public.html inline script mirrors them per the `buildPublicHTML`-identical convention. Scroll session key = drawn count + history length: re-broadcasts of the same commit continue the ticker instead of restarting it; the `reveal` phase stops it and paints the real title.

### 4. Timing: single constant 5000 ms, tolerance ±500 ms

`REVEAL_DELAY_MS` 3000 → 5000, still the one named constant owning the projector reveal. Tolerance widens 250 ms → 500 ms: the longer buffer plus ticker stepping plus `file://` storage-event latency make the old band flaky without adding signal. All existing 3000-asserting tests/scenarios are retuned, none deleted.

### 5. Guards re-keyed from spin to buffer, cancellation unchanged in shape

`drawBtn`/`confirmBtn` disabled predicate drops the `spinning` term and keeps `isPublicBuffer()`; `handleDrawClick`, `setCurrentStatus`, and `handleVoidRequest` keep their buffer-first refusals (the `st.spinning` terms become dead-false and are removed). `handleClearSongs`/`handleResetAll` keep cancelling the public buffer — the `draw.js` timer cancellation lines disappear with the deleted path. No double-reveal: `schedulePublicReveal` already cancels-before-scheduling (single owner).

### 6. `draw-engine` delta folds option A (no stale spec)

The main `draw-engine` spec requirements `Cancellable reveal timeout with fixed spin base` and `Spinning guard blocks draw and confirm` are rewritten by this change's third delta (`specs/draw-engine/spec.md`, option A): no operator spin machinery and no 2750 ms spin base on the dashboard (immediate result post-commit), while the cancellable-handle guards are retained re-keyed to the 5 s public buffer — clear/reset mid-buffer cancel the pending reveal so no ghost result appears, coherent with the C-03/C-11 guards. All original requirement and scenario titles are kept verbatim in the MODIFIED blocks (validate/archive rule); the stale spin content is negated inside the bodies, following the same pattern as the `Operator sees SORTEANDO state` scenario in the `draw-no-repeat` delta. The untouched `draw-engine` requirements (uniform secure selection, commit-before-render ordering guarantee) are out of scope and unchanged.

## Risks / Trade-offs

- [Resolved Q1, option A] ~~Stale `draw-engine` spec~~ → Folded as the third delta of this change (`specs/draw-engine/spec.md`); code and spec agree at archive, no follow-up needed.
- [Scroll shows a title equal to the drawn title text] → Mitigation: exclusion is by song id, asserted by test; identical titles from other remaining songs are legitimate teaser content, not a spoiler.
- [Longer 5 s buffer slows the show rhythm] → Accepted trade-off per operator decision; the dashboard is instant so VirtualDJ cueing starts at once, and the buffer is projector-only.
- [Ticker + reveal race on slow machines] → Mitigation: null-before-invoke timer pattern (already in codebase) plus single buffer owner; reveal always wins, scroll never paints post-reveal.
- [Payload duplicates song data on the wire] → A few KB per draw, transient only; accepted for zero-network operation.

## Migration Plan

No migration: no persisted schema change (`mbdj.v1` untouched, `spinning` never persisted), no config change. Rollback = revert the change; pre-change snapshots restore normally since the stored shape is identical.

## Open Questions

- **Q1 (RESUELTA — opción A, delta `draw-engine` sumado a este change): la stale `draw-engine` spec se retira en este mismo change.** ~~Options: (a) add a `draw-engine` delta to this change (one more artifact, same archive), (b) file a follow-up micro-change to retire it (code/spec disagree in between). See summary.~~ Decisión del operador: opción (a) — tercer delta `specs/draw-engine/spec.md`, mismo archive, sin follow-up.
- Q2 (deferrable): ticker step interval default 500 ms — tunable during apply without touching specs or tasks.
