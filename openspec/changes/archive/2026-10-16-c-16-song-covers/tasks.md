# Tasks — c-16-song-covers

## 1. Modelo + migración schema 1→2 (TDD)

- [x] 1.1 `core.js`: `createSong`/`createSession`/`state` con `coverUrl: null` y `schemaVersion: 2`, y `normalizeLine`/`parseText`/`buildDemoSongs` emitiendo `coverUrl: null`; verificar RED→GREEN con tests Node (song nueva expone `coverUrl: null`, `createSession().schemaVersion===2`)
- [x] 1.2 `store.js`: `SCHEMA_VERSION=2`, `load` migrando v1 (songs sin `coverUrl` → `null`) y rechazando solo versión desconocida/futura como `corrupt`; verificar con tests de migración (v1 restaura lista+historial+locked con covers `null`; v99 sigue `corrupt`; `save` escribe `schemaVersion: 2`)

## 2. Resolución auto en importación (TDD, mock fetch)

- [x] 2.1 `js/import.js`: `resolveCoverURL(song, fetchFn, opts)` (iTunes `term=artist title`, `limit=8`, pick exacto-insensible + tier relajado, `100x100`→`600x600`, timeout 12 s por intento, 1 retry ante fallo transitorio —timeout/aborto/rechazo/sin-respuesta—, sin retry ante respuesta válida sin match, `null` ante cualquier fallo terminal) + `enrichCovers(songs, fetchFn, onProgress?, opts?)` secuencial idempotente (salta songs con `coverUrl`); verificar con fetch mockeado (match→URL 600, sin match→`null` con 1 sola request, throw→retry→URL, timeout→abort+retry→URL, doble fallo→`null` con 2 calls, nulo ante `fetchFn` ausente)
- [x] 2.2 `js/app.js`: paste/demo/file llaman a `enrichCovers` post-`importSongs` solo si `!locked` y con progreso en `importMessage` ("Resolviendo tapas i/N… X con tapa"); verificar con tests de handlers mockeados (offline→catálogo intacto + nota visible; locked→cero fetch y `BLOCKED_MESSAGE`; conteo `N nueva(s), M duplicado(s)` intacto)
- [x] 2.3 Pre-show tuning (requisito operador 2026-10-15: "la carga + tapas se haría pre-show; completar automático online antes de manual"): timeout 4 s→12 s, `limit` 3→8, +1 retry solo-transitorio solo-vía-importación; progreso no-bloqueante i/N vivo ya existente intacto; orden fallback explícito automático-online → retry → `null` + manual. Criterio de aceptación: demo 12/x automático antes de manual (run real iTunes 12/12 previo se mantiene como referencia; re-verificar pre-show del operador). Inviolables intactos y verificados en suite: cero fetch si `locked`/offline/show, `coverUrl=null` fallback válido, scrub en `spinning`, locked-gating, XSS-safe, CSV 6 intacto, delay 5000 intacto — VERIFICADO 2026-10-15: suite 333/333 (326 base + 7 nuevos pre-show)

## 3. Campo manual por fila + lock (TDD)

- [x] 3.1 `js/app.js`: `normalizeCoverValue(raw)` (trim; `''`→`null`; `http(s)`→tal cual; bare filename sin `/,\,..`→`assets/covers/<name>`; resto→rechazo) + `handleCoverRequest(songId, raw)` guard-first `isImportBlocked()` con `BLOCKED_MESSAGE`, sin prompt ni fetch; verificar tests (set/clear/inválido/XSS `javascript:` rechazado, locked→`{blocked:true}` sin mutación)
- [x] 3.2 `render()`: input+botón+preview por fila (preview con `onerror`→placeholder, valores por `esc()`), deshabilitados con `locked=true`; verificar en harness DOM (fila muestra preview; locked deshabilita controles; set manual persiste vía `persistCurrentState` mock)

## 4. Render pública con fallback (TDD)

- [x] 4.1 `js/public.js`: `coverFor` extendido (`{kind:'image',src}` vs placeholder idéntico C-14) + `coverForInline` mirror + `paintCover`/`buildPublicHTML` con `<img onerror>` fallback; verificar tests Node existentes C-14 verdes + nuevos (con `coverUrl`→`kind:'image'`; `null`→placeholder hue/initial iguales; rota→fallback sin throw)
- [x] 4.2 `buildStateMessage('spinning')`: scrub de `coverUrl` en clones `drawn` (anti-spoiler artwork) sin cambiar la forma del envelope; verificar test (spinning nunca expone `coverUrl` del committed; `reveal` sí la lleva)

## 5. Integración, regresión y docs

- [x] 5.1 Regresión total: suite Node 295/295 + `tests.html` en verde y CSV de 6 columnas intacto (export con covers→6 cols, BOM/CRLF/quote/`sanitizeCsvCell` sin cambios); verificar ejecutando la suite y el smoke `file://` (abrir `index.html`+`public.html`, importar demo online→tapas, refresh→recupera v2 con banner, draw→placeholder/spinning sin spoiler→reveal con tapa, export→6 cols)
- [x] 5.2 Offline drill + docs: con red deshabilitada importar/pegar/demo→sortear→pública→confirmar/void→refresh→export todo OK con placeholders (remotas caídas, locales `assets/covers/` OK, cero fetch en show verificado en DevTools); crear `assets/covers/.gitkeep` y documentar pre-show (resolver con red, locales para temas clave, exportar CSV antes) donde el repo lo indique; verificar checklist ejecutado y archivado como evidencia del change — VERIFICADO 2026-10-15: drill Node 9/9 PASS con tripwire anti-red (evidencia en `docs/design/evidence/c-16/drill-offline.md`), suite 326/326, run real iTunes 12/12 demo; DevTools file:// queda al operador pre-show (ítem 11c firmado)

## Workflow follow-up

- `/opsx:verify` con evidencia real antes de declarar pass.
- `/opsx:archive c-16-song-covers` (sync specs + cierre) solo tras review `code-review` Standards+Spec pre-show.
