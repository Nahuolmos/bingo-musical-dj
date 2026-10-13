# Music Bingo DJ — Instrucciones para Agentes

> Este archivo (y su copia `CLAUDE.md`) es lo PRIMERO que todo agente lee al entrar al repo.
> Generado a partir de `knowledge-base/` y `CHANGES.md`. No editar a mano sin re-sincronizar ambos archivos.

---

## Stack Tecnológico

| Capa | Tecnologías | Versión mínima |
|------|-------------|----------------|
| UI / App | HTML + CSS + Vanilla JS (ES2021), multi-archivo (`index.html` + `public.html` + `css/` + `js/`), sin framework ni bundler | Chrome / Edge actualizado |
| Estado | JS + persistencia `localStorage` autosave versionado `mbdj.v1` en cada `render()` + banner recuperada + `beforeunload` | — |
| Doble pantalla | `BroadcastChannel('music-bingo-dj-on')` + `public.html` standalone (sin `document.write`), reveal en 2 fases con `REVEAL_DELAY_MS=3000` | Navegador con `BroadcastChannel` |
| Aleatoriedad | `crypto.getRandomValues` + rejection sampling (`secureIndex` único, sin duplicados) | WebCrypto disponible |
| Importación | `File.text()` + parseadores propios (`Artista - Titulo`, CSV `,`/`;`/tab, Sheets plano) + informe fila-por-fila; PDF/DOCX solo mejora progresiva online | — |
| Exportación | CSV con BOM, `Blob` + `URL.createObjectURL`, incluye motivo/estado/hora | — |
| Build / Runtime | Ninguno: abrir en `file://` directo; no requiere Node.js | — |

Detalle completo: [knowledge-base/02_descripcion_general.md](knowledge-base/02_descripcion_general.md)

---

## Base de Conocimiento

La fuente de verdad del dominio vive en `knowledge-base/`. **Leé el archivo relevante ANTES de implementar.**

| Archivo | Cuándo leerlo |
|---------|---------------|
| [01_vision_y_objetivos.md](knowledge-base/01_vision_y_objetivos.md) | Entender propósito y alcance v1 (un evento, un operador) |
| [03_actores_y_roles.md](knowledge-base/03_actores_y_roles.md) | DJ único, público con cartón físico |
| [04_modelo_de_datos.md](knowledge-base/04_modelo_de_datos.md) | Song, HistoryEntry (+motivo), Session (locked/startedAt) |
| [05_reglas_de_negocio.md](knowledge-base/05_reglas_de_negocio.md) | Reglas RN-SOR/RN-IMP/RN-SES/RN-PUB/RN-HIS |
| [06_funcionalidades.md](knowledge-base/06_funcionalidades.md) | US-001…013 por épica |
| [07_flujos_principales.md](knowledge-base/07_flujos_principales.md) | Importar, sortear+reveal 3s, anular, exportar |
| [08_arquitectura_propuesta.md](knowledge-base/08_arquitectura_propuesta.md) | Patrones multi-archivo, `<script>` clásicos (no modules) |
| [10_preguntas_abiertas.md](knowledge-base/10_preguntas_abiertas.md) | ⚠️ IN-01…07 a resolver ANTES de codear |

> ⚠️ Resolver las preguntas de prioridad **Alta** de `10_preguntas_abiertas.md` antes de arrancar el primer change.

---

## Skills Disponibles

| Agente | Rol | Skills que carga |
|--------|-----|------------------|
| Show Core | Sorteo, persistencia, lock sesión | `tdd`, `javascript-testing-patterns`, `diagnosing-bugs` (vía registry si se instala) |
| Pantallas | Panel DJ + pública proyector | `frontend-design`, `impeccable`, `web-design-guidelines` (referencia) |
| Calidad | Review + E2E pre-show | `code-review`, `playwright-best-practices`, `e2e-testing-patterns`, `javascript-testing-patterns` |
| Orquestación | OPSX/SDD/docs | `kb-creator`, `roadmap-generator`, `agents-md-generator` |

Cargá la skill correspondiente al contexto ANTES de escribir código.

> Los compact rules de cada skill los resuelve el orquestador desde `.atl/skill-registry.md` (generado por `skill-registry`; no versionado — no está en el repo). Esta tabla solo mapea skill→rol.

Instaladas en este proyecto: `tdd`, `frontend-design`, `code-review`, `impeccable`, `playwright-best-practices`, `e2e-testing-patterns`, `javascript-testing-patterns`. Ver [.atl/skill-registry.md](.atl/skill-registry.md).

---

## Roadmap de Changes

13 changes en 5 fases, crítico v2: `C-01→C-02→C-04→C-07→C-08→C-10→C-11`. Primer change: `C-01 foundation-multifile` (partir single-file, estructura `public.html` + `css/` + `js/`). Detalle: [CHANGES.md](CHANGES.md). Flujo: `/opsx:propose <change>` → implementar → `/opsx:archive <change>`.

---

## Reglas Duras (específicas del proyecto)

No hay `~/.claude/CLAUDE.md` global en esta máquina — este proyecto trae las universales + las propias. Si el global aparece, el proyecto lo hereda y esta sección queda solo con las específicas.

1. **NUNCA single-file** → partir en `index.html` + `public.html` + `css/styles.css` + `js/{app,core,import,draw,store,public}.js`; `index.html` era solo prueba.
2. **NUNCA `type="module"` desnudo** → usar `<script>` clásicos (rompe `file://` por CORS).
3. **NUNCA depender de CDN para la ruta principal** → TXT/CSV/pegar/demo offline siempre; pdf.js/mammoth solo progresivo con fallback probado.
4. **NUNCA repetir sorteada ni decidir por animación** → `secureIndex` único antes del giro; pública en 2 fases (`spinning` sin título → `reveal` con `REVEAL_DELAY_MS=3000` para VirtualDJ manual).
5. **NUNCA anular sin motivo ni reingresar sin regla** → motivo obligatorio persistido en entrada + CSV; `void` no vuelve sin regla explícita.
6. **NUNCA perder estado en silencio** → autosave `mbdj.v1` en cada `render()` + banner "Partida recuperada" + descarte explícito + `beforeunload` + fallback corrupto.
7. **NUNCA lista mutable mid-partida** → `locked=true` desde el primer sorteo; importar/vaciar bloqueado; desbloqueo solo administrativo con motivo + doble confirm + entrada auditable.
8. **NUNCA ocultar errores de importación ni descartar en silencio** → informe fila-por-fila (aceptadas/duplicadas/dudosas) + validación tamaño/tipo.
9. **NUNCA declarar test pasado sin ejecutar** → TDD red-green en seams (sorteo sin repetición, vacía, 1 canción, importación, recuperación) + E2E doble pantalla + smoke `file://` pre-show.
10. **NUNCA codear sin `code-review` Standards+Spec pre-show** → verifica no-repetir, commit-antes-animación, DJ/pública separados, motivo en historial.

Producto: no afirmar integración VirtualDJ automática (manual en v1); priorizar offline; actualizar docs y criterios cuando cambie comportamiento.

---

## Flujo de Trabajo

1. Leer KB relevante + `CHANGES.md` + `.atl/skill-registry.md` (compact rules vía orquestador).
2. `/opsx:propose <change>` (un change por vez, respeta gates).
3. Implementar con TDD estricto (RED→GREEN→TRIANGULATE→REFACTOR + tabla evidencia).
4. `/opsx:verify` con evidencia real (no declarar pass sin ejecutar).
5. `/opsx:archive <change>` (sync specs + cierra).
6. Re-correr fases sueltas: `/active-orchestrator:kb`, `:rules`, `:find-skill`, `:registry`.
