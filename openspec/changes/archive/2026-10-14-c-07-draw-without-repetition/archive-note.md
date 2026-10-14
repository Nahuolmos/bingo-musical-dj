# Archive note — c-07-draw-without-repetition

- **Archived:** 2026-10-14 → `openspec/changes/archive/2026-10-14-c-07-draw-without-repetition/`
- **Schema:** spec-driven. Artifacts: proposal + specs + design + tasks, all `done`. Tasks 10/10.
- **Spec sync:** new capability `draw-no-repeat` → `openspec/specs/draw-no-repeat/spec.md` (6 requirements, 13 scenarios, Purpose copied verbatim from delta). `draw-engine` spec untouched (proposal declares Modified: None).
- **Implementation (apply phase, verified only):** `js/draw.js` sets `st.locked=true` inside pickAndCommit before `spinning=true` + C-07 audit comment (closes C-04 dead-guard gap, draw→locked→reject round-trip). Tests: `tests/draw.test.js` 30/30, full suite 107/107 green, no C-03/C-04/C-06 regressions. `openspec validate c-07-draw-without-repetition` → valid:true.
- **Known limitation (follow-up, does NOT block archive):** `file://` manual smoke NOT run in a real browser (demo→sortear→locked→import rejected→exhaust→refresh banner). Contracts covered by tests (disabled + `No quedan canciones disponibles` + `Esperando listado` + SORTEANDO literals + C-06 save/load round-trip). Run it as part of pre-show verify (C-11 drill).
- **Unlocks:** C-08 (`public-screen-delayed-3s`) + C-09 (`confirm-void-reason`) — GATE 4 open.
