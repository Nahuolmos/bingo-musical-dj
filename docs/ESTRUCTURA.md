# ESTRUCTURA — Music Bingo DJ (C-01 foundation-multifile)

Fecha baseline monolith: 2026-10-13. Monolito original: `index.html` 29 957 bytes / 55 líneas
(referencia preservada en `index.monolith.html` — NO borrar hasta paridad verde).
Baseline `file://`: doble-click en Chrome/Edge abre panel operador sin errores de consola
(verificación estática: sin `type="module"`, sin fetch remoto en ruta principal; captura:
ver `index.monolith.html` lado a lado con `index.html`).

## Mapa de archivos

| Ruta | Rol | Carga |
|------|-----|-------|
| `index.html` | Entrypoint operador (shell delgada, sin `<style>` inline) | doble-click `file://` |
| `public.html` | Pantalla pública standalone (sin `document.write`) | `window.open('public.html','musicBingoPublic',…)` + `setTimeout(broadcast,250)` |
| `css/styles.css` | Estilos verbatim extraídos del `<style>` monolítico (7310 bytes, diff cero) | `<link rel="stylesheet" href="css/styles.css">` |
| `js/core.js` | Estado compartido `MBDJ.state` + `makeId`, `esc`, `available` | 1º |
| `js/import.js` | `normalizeLine`, `parseText`, `dedupe`, `importSongs` (contrato mensajes) | 2º |
| `js/draw.js` | `secureIndex` rejection sampling + `pickAndCommit` commit-antes-animación | 3º |
| `js/store.js` | Stub persistencia `save`/`load`/`clear` (C-06 implementa `localStorage mbdj.v1`) | 4º |
| `js/public.js` | `PUBLIC_CHANNEL='music-bingo-dj-on'` + `buildPublicHTML()` idéntico a `public.html` | 5º (+ bootstrap mínimo en `public.html`) |
| `js/app.js` | Bootstrap operador: `render`, `broadcast`, wiring `getElementById`, demo 12, CSV BOM, `fileInput`, `openPublic` | 6º |
| `tests/*.test.js` | Harness Node `node:test` + `assert/strict`, cero installs | `node --test tests/core.test.js tests/import.test.js tests/draw.test.js tests/store.test.js tests/structure.test.js` |
| `tests.html` | Espejo browser del harness (doble-click `file://`, sin Node) | doble-click |
| `assets/lista-ejemplo.csv` | Demo 12 filas (`,`/`;`/tab + `Artista - Titulo`, diacríticos, 1 header a saltear) | importar offline → 12 canciones |
| `docs/PRE_SHOW_CHECKLIST.md` | Drill pre-show (proyector, popups, VDJ manual, offline, export) | lectura operador |
| `index.monolith.html` | Referencia comportamiento (auditoría 1.1: `$`, `esc`, `normalizeLine`, `makeId`, `parseText`, `dedupe`, `available`, `broadcast`, `render`, `setMessage`, `importSongs`, `draw` sesgado + `secureIndex` + handler rebotado, `setCurrentStatus`, `publicHTML`, `openPublic`, `loadScript`, wiring `sampleBtn`/`exportLog`/`fileInput`/`copyResult`/`skipResult`; gaps IN-01…IN-07 en propuesta) | solo referencia |

## Orden de carga (clásico, sin `type="module"`)

```html
<script src="js/core.js"></script>
<script src="js/import.js"></script>
<script src="js/draw.js"></script>
<script src="js/store.js"></script>
<script src="js/public.js"></script>
<script src="js/app.js"></script>
```

`type="module"` desnudo prohibido: rompe `file://` por CORS. Sin bundler, sin build.

## Propiedad de globales

- `MBDJ.state` (core) — única fuente: `{ songs, history, current, spinning }`.
- `MBDJ.core` — `makeId`, `esc`, `available`, `$` (null en Node).
- `MBDJ.import` — parsing puro + `importSongs` muta `MBDJ.state.songs`.
- `MBDJ.draw` — `secureIndex`, `pickAndCommit`, `finishCommit`.
- `MBDJ.store` — stub; C-06 lo llena sin cambiar orden.
- `MBDJ.public` — canal + builder; `public.html` escucha `BroadcastChannel`.
- `MBDJ.app` — `render`, `broadcast`, `handleDrawClick`, `buildDemoSongs`, `buildCsv`, `openPublic`, `initApp`.

Cada `js/*.js` carga en Node sin crash `window`/`document` (wiring diferido a `initApp`/`render`).

## C-04 import-catalog (offline freeze)

- Formatos offline aceptados (pegar texto + demo, sin internet): líneas `Artista - Titulo`
  (separadores `-`/–/—), filas CSV/TSV `artista,titulo` (`,`/`;`/tab; primera celda = artista,
  resto = título, salvo filas que empiezan con URL que usan parseo de línea), semilla demo 12
  vía la misma ruta `importSongs` (repetir no duplica). Primera línea header
  (`titulo/cancion/song/track` + separador) se saltea.
- Dedupe normalizado `title|artist` (minúsculas, sin diacríticos, espacios colapsados),
  intra-lote y contra el listado; reporte nunca silencioso:
  `N nueva(s), M duplicado(s) omitido(s)`; vacío:
  `No se detectaron canciones. Revisá el formato del archivo o pegá el texto manualmente.`
- Sesión bloqueada (`locked=true`): pegar/demo/archivo rechazados con mensaje + no-op
  (sin mutar `locked`; desbloqueo administrativo en C-11, que reutiliza el string verbatim):
  `Lista bloqueada. Usá el Desbloqueo administrativo (C-11) para modificar el listado.`
- Guard único `MBDJ.app.isImportBlocked()` + `guardedImport`/`handlePasteImport`/`handleDemoImport`;
  revisión con `reviewCounters`/`filterSongs`/`artistLabel` (consumidos por `render`).
- Tests: `node --test tests/import.test.js` + espejo `tests.html` (doble-click `file://`).

## Verificación

- `css/styles.css` diff cero vs bloque `<style>` monolítico (extracción por script, 7310 bytes).
- `node --test` por archivo (Windows: sin glob carpeta; ver comando arriba) verde offline, cero installs.
- `tests.html` doble-click verde, sin errores consola.
- `index.html`/`public.html` paridad visual vs `index.monolith.html` lado a lado.
- Fallback server (solo si `file://` falla en máquina del evento): `npx serve .` — no requerido.
