# CHANGES — Secuencia de Implementación

> Índice canónico de todos los changes del proyecto **Music Bingo DJ**.
> Cada change es atómico: un agente puede implementarlo en una sesión (~4-6 horas).
> **Leer este archivo antes de ejecutar cualquier `/opsx:propose`.**

> **Re-run 2026-10-13 (v2)**: incorpora 4 constraints del operador — (1) NO single-file, (2) pública con retraso ~3 s para VirtualDJ manual, (3) persistencia obligatoria, (4) bloqueo de lista al iniciar. Ver §Qué cambió vs v1 al pie. IDs `C-01…C-13` conservados (sin duplicar sin motivo); solo se renombran 3 títulos para reflejar el nuevo scope.

---

## Cómo usar este documento

1. Identificar el change a implementar (verificar que sus dependencias están en `openspec/changes/archive/`).
2. Leer los docs de la knowledge-base indicados en "Leer antes".
3. Ejecutar `/opsx:propose <nombre-del-change>`.
4. Al terminar el change, archivarlo con `/opsx:archive <nombre-del-change>`.
5. Marcar el checkbox `[x]` en este archivo.

---

## Árbol de dependencias

```
C-01 foundation-multifile
  └── C-02 session-models-core           ← desbloquea TODO lo demás
        │
        ├── C-03 draw-engine-secure      [rama motor]
        │     └── C-07 draw-without-repetition ──┐
        │                                        │
        ├── C-04 import-text-csv-demo ──┐        │
        │     └── C-05 import-file-excel-pdf     │
        │                               │        │
        ├── C-06 session-persistence-recovery    │  ← OBLIGATORIO v1 (no opcional)
        │                                       │
        └──── C-03 + C-04 convergen ────────────┘
                    │
                    ├── C-08 public-screen-delayed-3s ──┐
                    │                                   │
                    ├── C-09 confirm-void-reason ───────┤
                    │                                   ▼
                    │                         C-10 history-export-audit
                    │                                   │
                    │                         C-11 session-lock-guards-offline-drill ✓ v1 show-ready
                    │
                    ├── C-12 backlog-cards-stats-theming (post-evento) ← C-04 + C-10
                    └── C-13 backlog-virtualdj-spike (post-evento)     ← C-07
```

### Paralelismo por fase

> Cada "gate" es un punto de sincronización. Los changes dentro de un grupo pueden ejecutarse en paralelo.

```
GATE 0: ninguna
  → C-01 foundation-multifile (solo)

GATE 1: C-01 ✓
  → C-02 session-models-core (solo)

GATE 2: C-02 ✓                     ← PRIMER FORK (3 paralelos)
  → C-03 draw-engine-secure        [Agente A]
  → C-04 import-text-csv-demo      [Agente B]
  → C-06 session-persistence-recovery [Agente C — OBLIGATORIO v1, no postergable]

GATE 3: C-04 ✓
  → C-05 import-file-excel-pdf     [Agente B]
  → C-07 draw-without-repetition   [Agente A — si C-03 ✓]

GATE 4: C-07 ✓                     ← FORK show en vivo (2 paralelos)
  → C-08 public-screen-delayed-3s  [Agente C — requiere C-07; coordina buffer VDJ]
  → C-09 confirm-void-reason       [Agente A]

GATE 5: C-08 + C-09 ✓
  → C-10 history-export-audit      [Agente A — incluye Motivo de C-09 + reveal retardado de C-08]

GATE 6: C-06 + C-10 ✓              ← C-06 es gate duro: sin persistencia no hay show-ready
  → C-11 session-lock-guards-offline-drill [Agente B — bloqueo + drill offline]

GATE 7: v1 show-ready (C-11 ✓)     ← FORK backlog post-evento (2 paralelos, fuera del camino crítico)
  → C-12 backlog-cards-stats-theming  [Agente C — si C-04 + C-10 ✓]
  → C-13 backlog-virtualdj-spike      [Agente A — si C-07 ✓]
```

### Camino crítico (7 changes — mínimo irreducible)

```
C-01 → C-02 → C-04 → C-07 → C-08 → C-10 → C-11
```

> Nota: C-03 (motor seguro), C-06 (persistencia obligatoria) y C-09 (confirm/anular) también son requisitos de v1 y corren en paralelo con la cadena (C-03+C-04 en paso 3, C-06 en paso 3, C-09 en paso 5); no alargan la cadena porque caben en los mismos pasos del plan. Sin C-06 ✓ o C-09 ✓ no se declara show-ready aunque la cadena lineal esté verde.

### Plan óptimo con 3 agentes

```
Paso │ Agente A (Motor + sorteo)      │ Agente B (Importación + blindaje)      │ Agente C (Pública + resiliencia)
─────┼────────────────────────────────┼────────────────────────────────────────┼────────────────────────────────────
  1  │ C-01 foundation-multifile      │ —                                      │ —
  2  │ C-02 session-models-core       │ —                                      │ —
  3  │ C-03 draw-engine-secure        │ C-04 import-text-csv-demo              │ C-06 session-persistence-recovery
  4  │ C-07 draw-without-repetition   │ C-05 import-file-excel-pdf             │ —
     │ (si C-03 + C-04 ✓)             │                                        │
  5  │ C-09 confirm-void-reason       │ —                                      │ C-08 public-screen-delayed-3s
  6  │ C-10 history-export-audit      │ —                                      │ —
  7  │ —                              │ C-11 session-lock-guards-offline-drill │ —
  8  │ C-13 backlog-virtualdj-spike   │ —                                      │ C-12 backlog-cards-stats-theming
     │ (post-evento)                  │                                        │ (post-evento)
```

---

## FASE 0 — Cimientos multi-archivo y modelos

> C-01 parte el single-file (constraint 1). C-02 define el modelo que el resto consume, incluyendo `locked` y esquema persistido.

### [C-01] `foundation-multifile`
- **Estado**: `[x]` completado (2026-10-13, archivado en `openspec/changes/archive/2026-10-13-c-01-foundation-multifile/`)
- **Scope**: Scaffolding portable multi-archivo + harness de pruebas sin romper el doble-clic (US-011, US-012, US-013; constraint 1 NO single-file)
  - Partir `index.html` (~30 KB, solo referencia de conducta — la primera prueba no se extiende) en estructura propuesta y documentada en `docs/ESTRUCTURA.md`:
    - `index.html` (operador, entrypoint delgado) + `public.html` (pantalla pública standalone, sin `document.write`)
    - `css/styles.css` (extraído del `<style>` actual, sin cambio visual)
    - `js/core.js` (modelos Session/Song/HistoryEntry) + `js/import.js` (`normalizeLine`, `parseText`, `dedupe`) + `js/draw.js` (`secureIndex`, commit) + `js/store.js` (persistencia, implementada en C-06) + `js/public.js` (render pública) + `js/app.js` (bootstrap operador, orden de carga)
  - Restricción portable: **sin bundler, sin `type="module"` desnudo** (rompe `file://` por CORS); usar `<script>` clásicos en orden o documentar alternativa `npx serve` como fallback. Todo debe abrir por doble clic en Chrome/Edge.
  - Auditoría de solo lectura de `index.html`: inventariar funciones (`normalizeLine`, `parseText`, `dedupe`, `available`, `draw`, `secureIndex`, `setCurrentStatus`, `broadcast`, `publicHTML`, `openPublic`) y brechas IN-01…IN-07 como checklist de migración (nada se borra hasta que el multi-archivo pasa los tests).
  - Harness portable: `tests/` con runner sin build (`tests/*.test.js` con Node `--test` + espejo `tests.html` abrible por doble clic) que importa los `js/*.js` ya partidos (no el monolito).
  - `assets/lista-ejemplo.csv` anonimizada (12 filas demo, `,`/`;`/tab + `Artista - Titulo`); `docs/PRE_SHOW_CHECKLIST.md` inicial (proyector, popups, audio/VDJ manual, prueba offline, export previo).
  - Tests: cada `js/*.js` carga por doble clic y en Node; sin regresión visual operador/pública tras la partición.
- **Dependencias**: ninguna
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/01_vision_y_objetivos.md` §Alcance v1
  - `knowledge-base/02_descripcion_general.md` §Stack tecnológico
  - `knowledge-base/08_arquitectura_propuesta.md` §Estructura de directorios
  - `knowledge-base/10_preguntas_abiertas.md` §Preguntas abiertas

---

### [C-02] `session-models-core`
- **Estado**: `[x]` completado (2026-10-13, archivado en `openspec/changes/archive/2026-10-13-c-02-session-models-core/`)
- **Scope**: Modelo de dominio en módulos consolidado, con bloqueo y esquema persistible (RN-SOR-01, RN-HIS-01, RN-HIS-03, RN-SES-01)
  - Entidades en `js/core.js` (no en el monolito): `Song {id,title,artist,status,addedAt}`, `HistoryEntry {n,id,title,artist,status,time,motivo}`, `Session {songs,history,current,spinning,locked,startedAt,schemaVersion}` + vistas `total/remaining/drawn`.
  - Nuevo campo `Session.locked: boolean` (false hasta el primer sorteo; lo activa C-07, lo exige C-11) + `schemaVersion: 1` para la restauración de C-06.
  - Transiciones: `Song available → drawn → played | void` (terminal, sin reingreso v1); `HistoryEntry drawn → played | void` in-place vía `findLast`.
  - `esc()` aplicado en lista, historial y render pública (`js/public.js`); `makeId()` (`'s' + base36(timestamp) + rand`), `time` en `es-AR HH:MM:SS`, `n` único y monótono.
  - Tests: transiciones válidas/inválidas, `n` monótono, snapshot congela título/artista, `esc()` neutraliza `<script>`, `locked` inicia false y `schemaVersion` presente.
- **Dependencias**: C-01
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Entidades
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio: Sorteo (RN-SOR) + §RN-SES-01
  - `knowledge-base/08_arquitectura_propuesta.md` §Patrones aplicados
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-02, §DD-05

---

## FASE 1 — Motor de sorteo, importación y persistencia obligatoria

> C-03, C-04 y C-06 en paralelo tras C-02. C-04 antes de C-05 y C-07. C-06 es OBLIGATORIO v1 (constraint 3), no opcional ni postergable.

### [C-03] `draw-engine-secure`
- **Estado**: `[x]` completado (2026-10-13, archivado en `openspec/changes/archive/2026-10-13-c-03-draw-engine-secure/`)
- **Scope**: Un único motor aleatorio seguro + timeout cancelable (RN-SOR-02, RN-SOR-03, IN-04), ya en `js/draw.js`
  - Eliminar `draw()` original con sesgo de módulo; conservar solo `secureIndex()` con rejection sampling sobre `crypto.getRandomValues`.
  - Guardar el `setTimeout` del reveal en handle cancelable; `Vaciar lista` / `Reiniciar` lo cancelan (sin reveals fantasma mid-giro). Duración base 2750 ms de giro + buffer VDJ de C-08 por separado (no mezclar).
  - Comentario en código que declara el compromiso previo (commit-before-render) para auditoría.
  - Tests: uniformidad chi-cuadrado, sin sesgo de módulo, cancelación ante vaciado/reinicio, `spinning` bloquea sorteo y confirmación.
- **Dependencias**: C-02
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Session
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio: Sorteo (RN-SOR-02, RN-SOR-03, RN-SOR-06)
  - `knowledge-base/07_flujos_principales.md` §Flujo 2
  - `knowledge-base/10_preguntas_abiertas.md` §IN-04

---

### [C-04] `import-text-csv-demo`
- **Estado**: `[ ]` pendiente
- **Scope**: Ruta offline de carga: pegar texto + CSV/TSV + demo + revisión (US-002, US-003, US-004; RN-IMP-01…04), en `js/import.js`
  - `normalizeLine`: ignora vacías, elimina numeración, separa `Artista - Titulo`, detecta CSV/TSV, salta encabezado (igual que v1).
  - `parseText` + `dedupe` por clave normalizada, intra-importación y contra lista; informa `N nueva(s), M duplicado(s) omitido(s)` — nada silencioso.
  - `sampleBtn`: 12 canciones demo sin duplicar; lista con filtro, estados, contadores, marca `Artista no especificado`.
  - Respeta `Session.locked` de C-02: si bloqueada, importar exige desbloqueo administrativo de C-11 (no bypass silencioso).
  - Tests: separadores, encabezado, numeración, diacríticos, dedupe, lista vacía, título solo, bloqueo activo rechaza importación directa.
- **Dependencias**: C-02
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Song
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio: Importación (RN-IMP)
  - `knowledge-base/06_funcionalidades.md` §Épica 1 (US-002, US-003, US-004)
  - `knowledge-base/07_flujos_principales.md` §Flujo 1

---

### [C-05] `import-file-excel-pdf`
- **Estado**: `[ ]` pendiente
- **Scope**: Carga por archivo con contingencia offline probada (US-001; RN-IMP-01/02; IN-05, IN-07)
  - Decidir `.xlsx`: o bien SheetJS **vendorizado local** (sin CDN, sigue offline y multi-archivo: `vendor/sheetjs/`), o bien procedimiento oficial "exportar a CSV / pegar texto" + mensaje que lo indica.
  - `fileInput.change`: TXT/CSV/TSV vía `File.text()`; PDF vía pdf.js 3.11.174 + worker, DOCX vía mammoth 1.8.0, ambos `loadScript` desde cdnjs bajo demanda.
  - Errores visibles: formato incompatible, nada detectable, PDF/DOCX sin internet ("verificá internet o usá Pegar texto").
  - Respeta `locked` igual que C-04.
  - `docs/PRE_SHOW_CHECKLIST.md`: prueba sin red obligatoria pre-evento.
  - Tests: matriz de extensiones, CSV con `;`/tab/encoding, mensaje offline simulado, `.xlsx` según decisión.
- **Dependencias**: C-04
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio: Importación + §RN-X-01
  - `knowledge-base/06_funcionalidades.md` §US-001
  - `knowledge-base/07_flujos_principales.md` §Flujo 1
  - `knowledge-base/10_preguntas_abiertas.md` §IN-05, §IN-07

---

### [C-06] `session-persistence-recovery`
- **Estado**: `[ ]` pendiente
- **Scope**: OBLIGATORIO v1 — la partida de 2 días sobrevive a refresh/cierre o avisa sin ambigüedad (US-012; RN-X-03; IN-06; constraint 3)
  - Autosave en `js/store.js` a `localStorage` (clave versionada p. ej. `mbdj.v1`, decisión `localStorage` vs IndexedDB documentada — se elige `localStorage` por simplicidad/portabilidad salvo justificación) en cada `render()`: `songs`, `history`, `current`, `locked`, `startedAt`, contadores + `savedAt`.
  - Restauración al abrir `index.html`: banner obligatorio "Partida recuperada del HH:MM DD/MM — verificá historial antes de seguir" + botón "Descartar y empezar de cero" (con confirmación). Cubre cierre entre día 1 y día 2 del evento único.
  - Sanitización futura contemplada (prefijos `=+-@` en CSV); restauración corrupta → estado vacío + mensaje "Respaldo dañado — se inició vacío, revisá el CSV exportado" (recuperación de estado testeada).
  - `beforeunload` con aviso si hay historial sin exportar.
  - Tests: refresh mid-show restaura lista+historial+`current`+`locked`; cierre día-1 → apertura día-2 restaura; corrupto cae a vacío con mensaje; sin persistencia (modo privado sin storage) avisa en lugar de fallar silencioso.
- **Dependencias**: C-02
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Session
  - `knowledge-base/05_reglas_de_negocio.md` §RN-X-03
  - `knowledge-base/06_funcionalidades.md` §US-012
  - `knowledge-base/10_preguntas_abiertas.md` §IN-06

---

## FASE 2 — Show en vivo: sorteo + pública con retraso VDJ

> C-08 y C-09 en paralelo tras C-07. C-08 implementa el retraso ~3 s (constraint 2, anti-spoiler + buffer VirtualDJ manual).

### [C-07] `draw-without-repetition`
- **Estado**: `[ ]` pendiente
- **Scope**: Sorteo uniforme sin repetición con commit antes de animar + activa bloqueo (US-005; RN-SOR-01…05; RN-SES-01; DD-03)
  - Handler `Sortear` en `js/draw.js`: verifica `!spinning && available().length`; elige `s = pool[secureIndex(pool.length)]`; compromete `s.status='drawn'`, `current=s`, `history.push({n,status:'drawn',time})` **antes** de animar; **activa `Session.locked=true`** en el primer sorteo (persiste vía C-06).
  - Bordes: 0 elegibles → deshabilitado + "No quedan canciones disponibles"; 1 elegible → determinista; sorteada nunca vuelve a elegible.
  - Durante el giro: sorteo y confirmación deshabilitados; textos "SORTEANDO" / "La ruleta está girando… El resultado ya fue elegido".
  - Tests: sin repetición en N sorteos, vacía bloquea, una sola determinista, agotado con mensaje, commit verificable antes del reveal, primer sorteo activa `locked`.
- **Dependencias**: C-03, C-04
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio: Sorteo (RN-SOR) + §RN-SES-01
  - `knowledge-base/06_funcionalidades.md` §US-005, §US-006
  - `knowledge-base/07_flujos_principales.md` §Flujo 2
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-02, §DD-03

---

### [C-08] `public-screen-delayed-3s`
- **Estado**: `[ ]` pendiente
- **Scope**: Doble pantalla con reveal retardado ~3 s para VirtualDJ manual, sin spoiler y legible (US-006, US-008; RN-PUB-01…03; IN-03; constraint 2)
  - `public.html` standalone (sin `document.write`): abre vía `window.open('public.html','musicBingoPublic','popup,…')`; reenfoca si abierta; `setTimeout(broadcast, 250)`; alerta si el bloqueador la frena. Fallback `BroadcastChannel` ausente → exigir Chrome/Edge actualizado.
  - Reveal en 2 fases (commit-before-render se mantiene): al comprometer se emite solo `{phase:'spinning'}` **sin título** (ruleta girando en ambas pantallas); el broadcast con `{phase:'reveal', title, artist}` se retrasa **~3000 ms tras el fin del giro del operador** para dar tiempo a buscar/reproducir en VirtualDJ manual. Constante `REVEAL_DELAY_MS = 3000` documentada en código y testeable.
  - Pública solo lectura: ruleta, título/artista gigantes, contador "Disponibles: N · Sorteadas: M", últimas 5 como pills; sin controles privados; mensaje intermedio "Buscando el tema en cabina…" durante el buffer.
  - Tests: pública no muestra título durante `spinning` ni durante el buffer de 3 s; reveal sincronizado tras el delay (±250 ms); sin controles privados; popup bloqueado avisa; `REVEAL_DELAY_MS` configurable sin romper commit previo.
- **Dependencias**: C-07
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/03_actores_y_roles.md` §RBAC — Matriz de permisos
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio: Pantalla pública (RN-PUB)
  - `knowledge-base/06_funcionalidades.md` §US-006, §US-008
  - `knowledge-base/07_flujos_principales.md` §Flujo 4
  - `knowledge-base/10_preguntas_abiertas.md` §IN-03

---

### [C-09] `confirm-void-reason`
- **Estado**: `[ ]` pendiente
- **Scope**: Confirmación played / anulación con motivo persistido, terminal y sin reingreso (US-007; RN-HIS-02/03; RN-SOR-06; IN-02)
  - Solo habilitado con `current` en `drawn` y sin giro ni buffer de C-08 pendiente; `Marcar reproducida` → `setCurrentStatus('played')` vía `findLast`, limpia `current`.
  - `Anular por incidencia` → `prompt()` de **motivo obligatorio** (no vacío) + confirmación; `motivo` persistido en `HistoryEntry` (vía C-06) y visible en lista/historial ("Anulada — {motivo}"); `void` terminal, mensaje "Informá al organizador".
  - Botón "Copiar título y artista" previo para búsqueda manual en VirtualDJ (coherente con el buffer de 3 s de C-08).
  - Tests: anular sin motivo bloquea, motivo persiste tras refresh (C-06) y sale en CSV (C-10), `void` no reaparece en `available()`, botones deshabilitados sin `current`/en giro/en buffer.
- **Dependencias**: C-07
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §HistoryEntry
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio: Historial (RN-HIS-02, RN-HIS-03)
  - `knowledge-base/06_funcionalidades.md` §US-007
  - `knowledge-base/07_flujos_principales.md` §Flujo 3
  - `knowledge-base/10_preguntas_abiertas.md` §IN-02

---

## FASE 3 — Evidencia y blindaje pre-show (con bloqueo de lista)

> C-11 cierra v1: bloqueo administrativo auditado (constraint 4) + drill offline con la nueva arquitectura.

### [C-10] `history-export-audit`
- **Estado**: `[ ]` pendiente
- **Scope**: Historial auditable + exportación CSV válida en Excel, incluyendo motivo y desbloqueos (US-009, US-010; RN-HIS-01…04)
  - Historial orden `n`, hora `es-AR HH:MM:SS`, estado in-place `Sorteada/Reproducida/Anulada` (+ motivo de C-09); desbloqueos administrativos de C-11 y correcciones/ausencias también quedan como entradas auditables con estado visible.
  - Exportar `music-bingo-historial.csv`: columnas `Nº,Título,Artista,Estado,Hora` (+ `Motivo`), comillas RFC + BOM `\ufeff`, sanitización anti-inyección (`=+-@`), vacío → solo encabezado. Incluye entradas de reveal retardado sin duplicar (una fila por sorteo).
  - Botones grandes (< 2 s por acción, RN-X-04); reinicio advierte "Exportá el historial primero" sin forzarlo. Export fin del día 1 recomendado en checklist (evento de 2 días).
  - Tests: 100% sorteos con entrada, orden/hora, CSV abre en Excel (BOM), comillas RFC, sanitización, encabezado-solo válido, motivo y desbloqueos presentes.
- **Dependencias**: C-08, C-09
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §HistoryEntry
  - `knowledge-base/05_reglas_de_negocio.md` §Dominio: Historial (RN-HIS)
  - `knowledge-base/06_funcionalidades.md` §US-009, §US-010
  - `knowledge-base/07_flujos_principales.md` §Flujo 5

---

### [C-11] `session-lock-guards-offline-drill`
- **Estado**: `[ ]` pendiente
- **Scope**: OBLIGATORIO v1 — bloqueo de lista + salvaguardas + ruta offline verificada en multi-archivo (US-011, US-013; RN-SES-01/02, RN-X-01/04; IN-01; constraint 4)
  - Bloqueo: una vez `locked=true` (C-07), importar/vaciar/editar lista queda deshabilitado en UI. Desbloqueo solo vía acción administrativa explícita ("Desbloqueo administrativo") con **motivo obligatorio + doble `confirm()`**, registrada como entrada auditable en historial (visible y exportada en C-10) y persistida (C-06).
  - `Vaciar lista` / `Reiniciar partida` con `confirm()` simple, doble con historial, reseteo de `locked=false` solo vía la vía administrativa anterior; timeout de giro + buffer de reveal (C-03/C-08) cancelados.
  - Drill offline en el equipo del evento con la estructura partida: demo/pegar/CSV → sortear → pública con delay 3 s → confirmar/anular → refresh (verifica C-06) → intento de editar bloqueado → exportar, **todo sin internet**; dependencias CDN documentadas con contingencia probada; checklist firmado en `docs/PRE_SHOW_CHECKLIST.md` (incluye prueba de persistencia día-1→día-2 y de bloqueo).
  - Tests: editar con `locked` bloquea sin vía admin; desbloqueo sin motivo bloquea; desbloqueo queda en historial+CSV; vaciado/reinicio mid-giro+buffer no deja reveal fantasma; ruta completa sin red en multi-archivo.
- **Dependencias**: C-06, C-10
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §RN-SES-01/02, §RN-X-01
  - `knowledge-base/06_funcionalidades.md` §US-011, §US-013
  - `knowledge-base/07_flujos_principales.md` §Flujo 6
  - `knowledge-base/10_preguntas_abiertas.md` §IN-01

---

## FASE 4 — Backlog post-evento (fuera de v1)

> No entra en el evento de dos días. Proponer solo con v1 show-ready (C-11 ✓). Ningún change promete control automático de VirtualDJ en v1 (DD-01). El delay de 3 s de C-08 es pausa manual, no integración.

### [C-12] `backlog-cards-stats-theming`
- **Estado**: `[ ]` pendiente
- **Scope**: Backlog de experiencia: cartones + estadísticas + theming (opcionales de discovery §6)
  - Generar/imprimir cartones propios desde la app (combinaciones únicas, PDF imprimible) — diferencial vs. Sacodejuegos/Bingo Maker.
  - Estadísticas del evento: temas cantados, duración (2 días), anulaciones con motivo + desbloqueos (fuente: C-10).
  - Theming por local: logo y colores configurables (hoy un solo diseño fijo); si se toca UI, al final del todo sobre producto estable multi-archivo.
  - Reutiliza `C-04` (catálogo) y `C-10` (historial como fuente); sin backend salvo aprobación.
  - Tests: unicidad de combinaciones, stats cuadran con historial (incluye 2 días), theming no rompe legibilidad del proyector.
- **Dependencias**: C-04, C-10
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/01_vision_y_objetivos.md` §Fuera de alcance
  - `knowledge-base/02_descripcion_general.md` §Integraciones externas
  - `knowledge-base/06_funcionalidades.md` §Épica 5
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-05, §DD-06

---

### [C-13] `backlog-virtualdj-spike`
- **Estado**: `[ ]` pendiente
- **Scope**: Spike documentado de integración futura VirtualDJ — sin automatizar en v1 (DD-01, pregunta abierta)
  - Investigar formato exacto: ¿mostrar el tema sorteado en VDJ vs. disparar reproducción? (pregunta abierta discovery §11). El buffer de 3 s de C-08 es el baseline manual a superar.
  - Prototipo aislado fuera de la ruta del show (no toca C-07/C-08); el panel v1 sigue con reproducción manual + "Copiar título y artista".
  - Salida: `docs/VDJ_SPIKE.md` con opciones, riesgos y recomendación; sin afirmar integración sin implementarla y probarla.
  - Tests: solo criterios de aceptación del spike (qué se probó, en qué equipo/versión VDJ).
- **Dependencias**: C-07
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §RN-X-02
  - `knowledge-base/07_flujos_principales.md` §Flujo 2
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-01
  - `knowledge-base/10_preguntas_abiertas.md` §Preguntas abiertas

---

## Qué cambió vs v1 (2026-10-13 re-run)

| # | Constraint | Cambio en CHANGES.md |
|---|------------|----------------------|
| 1 | NO single-file | C-01 renombrado a `foundation-multifile`: parte el monolito en `index.html` + `public.html` + `css/styles.css` + `js/{app,core,import,draw,store,public}.js`; prohíbe `type="module"` desnudo por `file://`/CORS; resto de changes ya referencian módulos en lugar del monolito. 5 fases conservadas (la partición cabe en FASE 0 sin nueva fase). |
| 2 | Pública 3 s | C-08 renombrado a `public-screen-delayed-3s`: reveal en 2 fases (`spinning` sin título → `reveal` con título tras `REVEAL_DELAY_MS=3000` post-giro); `public.html` standalone sin `document.write`; mensaje "Buscando el tema en cabina…". Camino crítico pasa por C-08 (antes indistinto C-08/C-09). |
| 3 | Persistencia | C-06 pasa de "decidir si persistir" a OBLIGATORIO v1: autosave versionado en cada `render()` + banner de recuperación + descarte explícito + `beforeunload`; cubre hueco día-1→día-2; GATE 6 lo marca como gate duro sin el cual no hay show-ready. C-02 agrega `locked/startedAt/schemaVersion`; C-09/C-10/C-11 asumen persistencia. |
| 4 | Bloqueo lista | C-11 renombrado a `session-lock-guards-offline-drill`: `locked=true` desde C-07, UI bloqueada, desbloqueo solo administrativo con motivo + doble confirm + entrada auditable en C-10; C-04/C-05 respetan `locked`. IN-01/RN-SES-01 pasan de "a decidir" a implementado en v1. |
| — | Orden | Camino crítico: `C-01 → C-02 → C-04 → C-07 → C-09 → C-10 → C-11` (v1) → **`C-01 → C-02 → C-04 → C-07 → C-08 → C-10 → C-11`** (v2). C-03/C-06/C-09 en paralelo sin alargar. Plan de 3 agentes idéntico en pasos, con C-06 marcado obligatorio y C-08 en la cadena crítica. |
