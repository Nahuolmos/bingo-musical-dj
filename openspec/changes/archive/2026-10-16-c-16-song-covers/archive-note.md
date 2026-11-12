# Archive Note — c-16-song-covers

**Archived:** 2026-10-16 → `openspec/changes/archive/2026-10-16-c-16-song-covers/`
**Schema:** spec-driven
**Sync:** 7 deltas → 6 main specs + 1 spec nueva. ADDED a `import-catalog` (covers best-effort en paste/demo), `import-file` (covers best-effort en archivos), `public-screen` (slot prefiere imagen + CSV sigue 6 columnas), `session-lock` (campo tapa gated por lock); MODIFIED `session-models` (Song suma `coverUrl`, Session `schemaVersion: 2`) + ADDED (migración legacy → `null`); MODIFIED `session-persistence` (autosave v2 con migración v1, corrupt solo ante versión desconocida/futura); NUEVA `song-covers/spec.md` (Purpose verbatim del delta + 3 requirements: resolución import, override manual, render). Títulos y `## Purpose` existentes preservados; sin headers delta en main specs. `openspec validate --specs --strict` 13/13 limpio.
**Tasks:** 11/11 complete.
**Tests:** suite 334/334 VERDE (333 + 1 test B1 de bundle emitido; comando canónico con lista explícita de 21 archivos — `node --test tests/` literal falla en este entorno Win por invocación, no por código). Re-verificado en archive: `tests/song-covers.test.js` 39/39 (incluye `c-16 B1` + tuning 12s/8/1).

## Bugs del change (ambos con fix TDD + test)

1. **bug demo-covers (2026-10-15):** demo online resolvía 0–1 tapas. Causa raíz: matching exacto fallaba 4/12 (comillas curvas, sufijos feat/paréntesis) tapado por fallback `results[0]` dependiente de orden; con red lenta colapsaba a 0. Fix en `js/import.js` (tier relajado `pickCoverResult` + `onProgress`) y `js/app.js` (progreso i/N + persist por tapa). Referencia: run real iTunes 12/12 demo.
2. **B1 escape-template (2026-10-16, hallazgo review Spec):** el inline de `coverUrlOfInline` dentro del template `buildPublicHTML` (`js/public.js:46`) emitía `/^s+|s+$/g` (template literal comía la barra de `\s`): recortaba letras `s` en vez de espacios → tapa válida terminada en `s` (ej. `https://x.com/photos`) → 404 → placeholder en proyector. Violaba "Reveal with cover shows image". Fix mínimo: `\\s` en fuente + `public.html` regenerado desde el builder + 1 test de bundle emitido (describe `c-16 B1`: `photos` y `salsa.jpg` intactas, `'  url  '` con trim). RED dio `'https://x.com/photo'` vs `'https://x.com/photos'` (prueba exacta del bug).

## Tuning pre-show (requisito operador 2026-10-15)

Timeout 4s→**12s** por intento, `limit` 3→**8**, **+1 retry** solo-transitorio solo-vía-importación (timeout/aborto/rechazo/sin-respuesta; sin retry ante respuesta válida sin match). Orden fallback explícito: automático-online → retry → `null` + manual. Inviolables intactos: cero fetch si `locked`/offline/show, `coverUrl=null` fallback válido, scrub en `spinning`, locked-gating, XSS-safe, CSV 6 intacto, delay 5000 intacto. Drill offline 9/9 PASS con tripwire anti-red (evidencia en `docs/design/evidence/c-16/drill-offline.md`); run real iTunes 12/12 demo.

## Review pre-show (`code-review` Standards+Spec, base `origin/main 3eb4041`)

- **Standards: APROBADO-CON-NOTAS** (0 bloqueantes).
- **Spec: BLOQUEADO → FIXED verificado** (1 bloqueante = B1 bundle trim; fix mínimo aplicado + suite 334/334 + `tests/song-covers.test.js` 39/39 re-verificado en archive).

## MANUAL-PENDIENTE (no bloquea el archive; al operador pre-show)

Smoke `file://` real en navegador + DevTools cero-fetch en show + checklist 11c (`docs/PRE_SHOW_CHECKLIST.md`) firmado por el operador.

## Implementation touched (verify only, no re-implementado en archive)

- `js/core.js` (`coverUrl: null`, `schemaVersion: 2`) + `js/store.js` (`SCHEMA_VERSION=2`, migración v1) + `js/import.js` (`resolveCoverURL`/`enrichCovers`, tier relajado) + `js/app.js` (handlers post-`importSongs`, `normalizeCoverValue`/`handleCoverRequest`, inputs por fila) + `js/public.js` (`coverFor`/`coverForInline`/`paintCover`, scrub en `spinning`, B1 `\\s`) + `public.html` (regenerado verbatim desde el builder)
- `tests/song-covers.test.js` (nuevo, 39 tests incl. B1) + `tests.html` (harness espejo) + `assets/covers/.gitkeep` + `docs/design/evidence/c-16/drill-offline.md` + `docs/PRE_SHOW_CHECKLIST.md` (ítem 11c)
- Scratch del change: ninguno (drill corrió en script temporal fuera del repo). NO se tocó `assets/covers/` (solo `.gitkeep` ya existente del change), ni `docs/design/evidence/c-16/`, ni C-17.

## Downstream

- C-17 (`c-17-dj-gated-reveal`, propuesto, 0/16) NO se toca en este archive — sigue activo en `openspec/changes/`. Next action: apply C-17.
- Sin commit ni push por instrucción (todo queda en working tree; ver `git status` en el reporte de cierre).
