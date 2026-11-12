# Design: c-17-dj-gated-reveal

## Context

See proposal.md for motivation. Current state (C-15 archived): `handleDrawClick()` (`js/app.js`) commits via `pickAndCommit()` → paints dashboard result instantly → `broadcast('spinning')` carrying `scrollPool` (remaining post-commit, drawn excluded by id) → schedules the 5 s public buffer (`REVEAL_DELAY_MS=5000`, ticker `SCROLL_STEP_MS=120` in `js/public.js`) → `broadcast('reveal')`. Guards key on `isPublicBuffer()`; commit-before-render and single history entry hold. C-16 (in-progress, not archived) adds `coverUrl` per song, scrubbed to `null` in the spinning envelope, travelling only on the reveal message. Store key `mbdj.v1` persists `{songs, history, current, locked, startedAt, savedAt, schemaVersion}` on every `render()`.

## Goals / Non-Goals

**Goals:**
- Sortear commits and shows the DJ the result privately with zero public animation until the DJ presses the reveal control.
- Public holds a neutral title-free wait (no scroll, no cover) until the gate, then runs the unchanged C-15 scroll 5 s + reveal.
- Gate survives refresh via the existing store; no auto-reveal, no timeout.
- C-16 covers stay spoiler-free (scrubbed until reveal); CSV stays 6 columns.

**Non-Goals:**
- No VirtualDJ integration change (still manual); no new persisted schema version; no La Pepa visual change; no history/CSV shape change (gate adds no rows/columns); no timer tuning (`REVEAL_DELAY_MS`/`SCROLL_STEP_MS` untouched).

## Decisions

### 1. Gated wait is a new phase, not a delayed timer

Commit path becomes: `pickAndCommit()` → dashboard paint → `broadcast('awaiting-gate')` (envelope WITHOUT `scrollPool`, current scrubbed title/artist/`coverUrl` → null per C-16 pattern) → set `awaitingGate=true` (in-memory + persisted). The existing 5 s buffer scheduler is NOT called at commit; the reveal control calls it (building `scrollPool` fresh from `available()` at gate time — the pool is identical since nothing can change mid-gate, but building late keeps one code path and avoids persisting transient wire data).

Alternative considered: schedule the 5 s timer at commit and just pause the public renderer — rejected, it splits timer ownership and risks a stale reveal if the DJ never presses; the gate must own the start.

### 2. One dashboard-only control with its own predicate

New `isAwaitingGate()` predicate (gate pending AND no buffer running) owns the `Revelar en pública` button visibility/enablement; `isPublicBuffer()` keeps owning the scroll/reveal window. Guards become `isAwaitingGate() || isPublicBuffer()` for draw + played/void confirm; the reveal control is the only action enabled mid-gate. Clear/reset cancel the gate (flag off, `broadcast('idle'|'reveal'-of-nothing → neutral)`, persist) — same cancel-before-schedule null pattern as the buffer owner, so at most one reveal per commit.

Alternative considered: reusing `isPublicBuffer()` for the gate — rejected, the two windows need distinct public rendering (neutral vs scroll) and distinct enablement (reveal control on vs off).

### 3. No timeout, no auto-reveal — persistence carries the gate

`awaitingGate` persists in `mbdj.v1` as an additive flag (no `schemaVersion` bump; missing flag hydrates as false). Boot with flag + `current` drawn restores dashboard result + enabled reveal control; public re-sync mid-gate gets `awaiting-gate` (never the title). `beforeunload`/banner semantics unchanged — a pending gate is unexported history like any unconfirmed draw. If C-16 archives first (`schemaVersion: 2`), the flag rides alongside `coverUrl` with the same additive rule (reconcile at apply if the main spec moved).

### 4. Distinct neutral copy for the gated wait

Gated wait shows its own neutral text (e.g. "En cabina… esperando al DJ" — final copy at apply, distinct from the in-buffer "Buscando el tema en cabina…"), static regardless of `prefers-reduced-motion` (no animation exists to reduce), placeholder cover, counters + last-five as usual (read-only contract intact).

### 5. Cover/CSV compat by construction

`awaiting-gate` envelope scrubs `coverUrl` (same scrub helper as the spinning envelope); `scrollPool` is only built/sent at gate time, and the reveal message carries `coverUrl` exactly as C-15/C-16 do today. CSV export untouched (gate adds no entry/column); history gains no row until played/void confirm as today.

## Risks / Trade-offs

- [Doble-reveal: DJ double-clicks the reveal control] → Mitigation: gate consumes itself synchronously on first press (flag off before scheduling); second press is a no-op (spec scenario "One gate starts one buffer").
- [Refresh mid-gate, then popup closed] → Mitigation: gate restores on dashboard; reopening the popup re-syncs into `awaiting-gate`; nothing auto-fires without the DJ.
- [C-16 lands mid-apply with `schemaVersion: 2`] → Mitigation: additive-flag rule holds for either version; apply reconciles the store shape against whichever main spec is current, no bump from this change.
- [DJ forgets the pending gate] → Accepted: dashboard shows the committed result + enabled reveal control persistently; no nag timer (keeps the show clock in DJ hands).
- [Stale `awaiting-gate` after clear/reset + crash between] → Mitigation: clear/reset persist flag-off in the same render; boot restores whatever the last persisted render wrote — same guarantee as C-06.

## Migration Plan

No migration: additive persisted flag, no schema bump, no config change. Rollback = revert the change; snapshots with the flag hydrate as no-gate on pre-change code (unknown field ignored), and pre-change snapshots hydrate as no-gate on new code.

## Open Questions

- Q1 (deferrable to apply): final neutral copy for the gated wait (spec only requires it distinct from the cabin message).
- Q2 (deferrable to apply): exact dashboard placement/label of `Revelar en pública` next to the result panel + copy button.
