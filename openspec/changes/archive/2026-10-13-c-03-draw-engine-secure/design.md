# Design

## Context

See proposal.md (Why). Current state (verified in repo): `js/draw.js` already exposes `secureIndex(n)` (rejection sampling), `pickAndCommit(forcedIndex?)`, and `finishCommit()`; the biased `random % n` path survives only as a commented audit note. The gap is in `js/app.js`: `handleDrawClick` fires an anonymous `window.setTimeout(..., 2750)` with no handle, and `clearSongs`/`resetAll` never cancel it (`resetAll` zeroes `spinning` but the callback still reveals a deleted song). Classic `<script>` order, `file://` portable, Node-safe modules via `require` fallback. Constraints: `SPIN_MS = 2750` base only — the C-08 `REVEAL_DELAY_MS = 3000` buffer stays separate; governance CRITICO, plan-only.

## Goals / Non-Goals

**Goals:**

- One executable random path (`secureIndex`) with an audit comment marking commit-before-render.
- Reveal timeout owned by `js/draw.js` as a cancellable handle; `app.js` clear/reset paths cancel it.
- Named `SPIN_MS = 2750` constant, injectable timer seam for `node:test` without real waits.
- TDD seams ready for chi-square uniformity, bias absence, cancellation, spinning guard.

**Non-Goals:**

- No repetition/uniform-without-replacement logic (C-07), no public-screen 3 s buffer (C-08), no motivo/void (C-09), no persistence (C-06), no import lock (C-04/C-11).

## Decisions

1. **Timer handle lives in `js/draw.js`, not `app.js`.** `draw.js` owns `revealTimer` + `scheduleReveal(fn)` / `cancelReveal()` / `isRevealing()`; `handleDrawClick` delegates scheduling, `clearSongs`/`resetAll` call `cancelReveal()`. Rationale: single owner beside `spinning` state makes ghost reveals impossible by construction; alternative (handle in `app.js`) rejected — splits the invariant across two modules and C-08/C-11 would each need their own copy.
2. **Keep `secureIndex` verbatim, delete executable legacy only.** The commented bias note stays for audit; no live `draw()` with `%` remains. Alternative (full rewrite with `Math.random` fallback) rejected — breaks RN-SOR-03 uniformity and offline determinism requirements.
3. **`SPIN_MS = 2750` literal in `draw.js`, exported for tests.** `scheduleReveal` defaults to it; tests inject short delays or fake timers. Alternative (hardcoded `2750` at call site) rejected — untestable and invites a second divergent literal when C-08 adds its buffer.
4. **Commit stays synchronous in `pickAndCommit`; animation only renders.** `handleDrawClick` calls `pickAndCommit()` first, then animates; the reveal callback only calls `finishCommit()` + `render()`. No state decision inside the timeout. Alternative (deferred commit at reveal) rejected — violates RN-SOR-02.
5. **Node-safe timer seam (`setTimeoutFn`/`clearTimeoutFn` injection).** Keeps classic scripts `file://`-compatible (no modules, no fake-timer lib, zero installs) while letting `node:test` assert cancellation deterministically.

## Risks / Trade-offs

- [Risk] Chi-square test flakiness on true randomness → Mitigation: fixed seed via injected `getRandomValues` stub for determinism + large-N band with 99% acceptance, plus a separate bias-absence test with independent literals (never recompute via the code path).
- [Risk] `cancelReveal` racing an already-fired callback → Mitigation: null the handle inside the wrapper before invoking `fn`; `cancelReveal` is idempotent and also clears `spinning` only via `finishCommit`.
- [Risk] C-08 confusion between `SPIN_MS` and `REVEAL_DELAY_MS` → Mitigation: distinct names, separate constants, spec scenario pinning the separation; design explicitly forbids merging.
- [Risk] `forcedIndex` test seam abused in production → Mitigation: document as test-only; production call sites pass no argument.

## Migration Plan

Pure in-place refactor, no data migration: `draw.js` gains constant + timer API, `app.js` rewires three call sites. Rollback = revert two files. No `locked`/`schemaVersion` change. Verify with `node --test tests/draw.test.js` + file:// smoke (sortear → vaciar mid-giro → no ghost).

## Open Questions

- None blocking. Timer-handle naming (`revealTimer` vs `spinTimer`) finalized at apply time without spec impact.
