# Proposal — c-09-confirm-void-reason

## Why

Anulaciones sin motivo registrado incumplen RN-HIS-02/RN-HIS-03: la evidencia post-evento no explica el porqué y el `void` solo existe como estado sin constancia (brecha IN-02). C-09 cierra esa brecha en v1 cerrando el loop sorteo→confirmación con motivo obligatorio, persistido y auditable.

## What Changes

- `Marcar reproducida` confirma `played`: `setCurrentStatus('played')` vía `findLast` (js/core.js), limpia `current`, habilitado solo con `current` en `drawn` y SIN giro (`spinning`) ni buffer público de C-08 pendiente (`isPublicBuffer()`).
- `Anular por incidencia` exige motivo en texto libre OBLIGATORIO (no vacío / no solo espacios) vía `prompt()` + `confirm()` de confirmación; cancelar cualquiera de los dos aborta sin mutar estado.
- `motivo` (trimmed) se persiste en el `HistoryEntry` correspondiente (campo ya existente desde C-02, default `''`) y sobrevive refresh vía autosave C-06 (`mbdj.v1`); visible en lista (`Anulada — {motivo}`) e historial.
- `void` es terminal: canción excluida de `available()`, mensaje "Informá al organizador", sin reingreso sin regla explícita (RN-SOR-01/RN-HIS-02).
- Botón "Copiar título y artista" (clipboard, fallback `prompt`) previo para búsqueda manual en VirtualDJ, coherente con el buffer 3 s de C-08.
- Botones de confirmación deshabilitados sin `current`/`drawn`, en giro o en buffer (mismo predicado que C-08 en `render()` + guards en `setCurrentStatus`).

## Capabilities

### New Capabilities

- `confirm-void`: confirmación played / anulación void con motivo obligatorio persistido, terminal y sin reingreso; gates de habilitación (current/spin/buffer); copiado manual para VirtualDJ.

### Modified Capabilities

- (none — `session-models` ya declara el campo `motivo` con default `''` "que C-09 requerirá"; `session-persistence` y `draw-no-repeat`/`public-screen` se consumen como contratos sin cambiar sus requirements; `import-catalog`/`draw-engine` no se tocan.)

## Impact

- Afecta: `js/app.js` (handlers `confirmBtn`/`skipResult`/`copyResult`, guards `render()`/`setCurrentStatus`, motivo en render de lista/historial), `js/core.js` (`findLast`/`setHistoryStatus` + motivo — sin cambiar transiciones), `js/store.js` (sin cambios — motivo viaja dentro del snapshot existente), `tests/` (nuevo `tests/confirm-void.test.js` + espejo `tests.html`), `docs/PRE_SHOW_CHECKLIST.md` (ítem confirmar/anular offline).
- Depende de: C-07 (commit `drawn` + `findLast` + `locked`) y gate C-08 (`isPublicBuffer()` — confirm bloqueado mid-buffer hasta el reveal).
- Downstream: C-10 consume `motivo` en CSV (columna Motivo); C-11 asume persistencia del motivo y terminalidad del `void`.
- Sin breaking changes: estados y esquema `mbdj.v1`/`schemaVersion: 1` intactos; motivo es string adicional dentro de la entrada existente.
