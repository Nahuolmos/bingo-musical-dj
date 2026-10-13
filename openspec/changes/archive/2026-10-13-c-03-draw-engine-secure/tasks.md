# Tasks

## 1. Secure engine hardening (RED→GREEN)

- [x] 1.1 RED: add failing chi-square uniformity test for `secureIndex` (6000 draws over 6 values, independent expected counts, 99% band) and verify it fails/runs via `cmd /c "node --test tests/draw.test.js"`
- [x] 1.2 GREEN: confirm `secureIndex` rejection sampling is the single executable random path (biased `%` only as audit comment) and verify uniformity + bounds tests pass via `cmd /c "node --test tests/draw.test.js"`
- [x] 1.3 Add bias-absence + edge tests (`n=1` deterministic literal `0`, modulo-shortcut scan with independent literals, no tautologies) and verify via `cmd /c "node --test tests/draw.test.js"`

## 2. Cancellable reveal timeout (RED→GREEN)

- [x] 2.1 RED: add failing cancellation tests (schedule reveal then `cancelReveal` before fire → callback never runs; `clearSongs`/`resetAll` paths cancel) with injected timer seam and verify failure via `cmd /c "node --test tests/draw.test.js"`
- [x] 2.2 GREEN: implement `SPIN_MS = 2750` + `revealTimer`/`scheduleReveal`/`cancelReveal`/`isRevealing` in `js/draw.js`, rewire `handleDrawClick`/`clearSongs`/`resetAll` in `js/app.js`, keep commit-before-render audit comment, and verify cancellation tests pass via `cmd /c "node --test tests/draw.test.js"`
- [x] 2.3 Add spinning-guard tests (second `pickAndCommit` while spinning returns `null`; confirm blocked mid-spin; `forcedIndex` used only in tests) and verify via `cmd /c "node --test tests/draw.test.js"`

## 3. Integration + pre-show verification

- [x] 3.1 Run full suite `cmd /c "node --test tests/"` plus `file://` smoke (open `index.html`, sortear, vaciar mid-giro → no ghost reveal, `SPIN_MS` ≠ C-08 buffer) and verify all green with no regressions
- [x] 3.2 Run `cmd /c "openspec validate --change c-03-draw-engine-secure"` and verify planning artifacts complete (proposal, draw-engine spec, design, tasks)

## Workflow follow-up

- Apply the change separately once confirmed (governance CRITICO); then archive with `/opsx:archive c-03-draw-engine-secure`.
