# Archive Note — c-09-confirm-void-reason

**Archived:** 2026-10-14 → `openspec/changes/archive/2026-10-14-c-09-confirm-void-reason/`
**Schema:** spec-driven · **Tasks:** 14/14 (11 apply + 3 fix §4) · **Suite:** 169/169 green · **`openspec validate --specs`:** 9/9 clean
**Apply outputs (already committed + pushed):** `c9aecea` — archive made no code changes.
**Human approval (CRITICO governance):** explicit user approval 2026-10-14 ("Si hazlo", engram obs-33ff755a16cd9b51) — apply + fix ran under it.

## What shipped

- `js/app.js`: `setCurrentStatus(status, motivo?)`, `handleVoidRequest(promptFn, confirmFn)` seam
  (motivo obligatorio no-vacío vía `prompt()` + `confirm()` explícito; cancel/vacío aborta sin
  mutación), `formatCopyText`/`handleCopyRequest` seams (`title — artist`, title-only sin artista,
  sin mutación), motivo renderizado escapado (`Anulada — {motivo}`), handlers rewired
  skip/copy, clear/reset con locked-guards (`BLOCKED_MESSAGE`, cero mutación), `bootRestore`
  locked+empty → `restored` + banner (escape Discard pre-C-11).
- `js/core.js`: `setHistoryStatus` 4º param motivo (backward compatible).
- `tests/confirm-void.test.js` (new, 20 tests), `tests/session-lock-recovery.test.js` (new, 8 tests),
  `tests/draw.test.js` + `tests/public.test.js` (6 ghost-cancel tests re-seated al régimen unlocked
  vía seam explícito `locked=false`; wipe-path wiring sin cambios), `tests.html` (mirror C-09 + checklist 6c).
- Spec synced: `openspec/specs/confirm-void/spec.md` (new capability, 6 requirements).
  Untouched: session-models, draw-engine, draw-no-repeat, public-screen, import-catalog,
  session-persistence. Music Bingo checks: anulación con motivo en historial ✓, no-repetir ✓,
  commit-before-render ✓, DJ/pública separados ✓.
- No regressions: suite completa 169/169 (161 baseline + 8 nuevas).

## Uncommitted at archive (orchestrator owns git — do NOT commit/push from archive)

Fix §4 outputs + orchestrator one-liner, todos en working tree, verificados cero-drift:
`js/app.js` guards, `tests/session-lock-recovery.test.js` (untracked),
`openspec/changes/c-09-confirm-void-reason/tasks.md` §4 (moved to archive with the change),
`tests.html` banner mirror node (`restoreBanner`, C-06 parity — aditivo, no toca el mirror C-09),
`tests/draw.test.js` + `tests/public.test.js` lock-regime seams (alcance del fix §4.3).

## Known limitation

No Playwright runner in this zero-install repo → verificación portable two-harness
(clock-mocked) + suite Node 169/169 ejecutada en archive. Real-browser `file://` smoke sigue
pendiente para el drill de C-11 (misma nota que C-07/C-08).

## Downstream contracts (for C-10 / C-11)

- **C-10 `history-export-audit`** (next) — columna Motivo en CSV: `HistoryEntry.motivo` ya persiste
  vía snapshot C-06; void terminal preservado (sin reingreso sin regla explícita).
- **C-11 `session-lock-guards-offline-drill`** — admin unlock aún pendiente; escape locked+empty
  = "Descartar y empezar de cero" por ahora. GATE 5 (C-08 + C-09) cierra la cadena show-ready v1
  salvo C-10/C-11.
