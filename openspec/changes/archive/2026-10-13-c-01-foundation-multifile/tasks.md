# Tasks — c-01-foundation-multifile

## 1. Read-only audit (no code writes)

- [x] 1.1 Inventory `index.html` functions and markup and verify the checklist lists `$`, `esc`, `normalizeLine`, `makeId`, `parseText`, `dedupe`, `available`, `broadcast`, `render`, `setMessage`, `importSongs`, biased `draw()`, `secureIndex()`, rebound secure draw handler, `setCurrentStatus`, `publicHTML()`, `openPublic` handler, `loadScript`, `sampleBtn`/`exportLog`/`fileInput`/`copyResult`/`skipResult` wiring plus IN-01…IN-07 gaps — verify by reading the checklist into the task record with zero edits outside `openspec/`
- [x] 1.2 Record `file://` baseline (monolith double-click in Chrome/Edge, console-error-free) and verify with a dated note plus screenshot reference in `docs/ESTRUCTURA.md` draft

## 2. Scaffold + verbatim CSS extraction

- [x] 2.1 Create `css/`, `js/`, `tests/`, `assets/` dirs and thin `index.html` shell linking `css/styles.css` with classic `<script>` tags in order `core → import → draw → store → public → app`, and verify `index.html` contains no `type="module"` and no inline `<style>` by grep
- [x] 2.2 Extract `<style>` byte-identically to `css/styles.css` and verify with `diff` of source block vs. extracted file showing zero differences plus side-by-side visual compare passes

## 3. JavaScript split (verbatim behavior, Node-safe imports)

- [x] 3.1 Extract `js/core.js` (Session/Song/HistoryEntry shapes, `makeId`, `esc`, `available`) with browser-only access deferred and verify with `node --import` load test showing no `window`/`document` crash at import
- [x] 3.2 Extract `js/import.js` (`normalizeLine`, `parseText`, `dedupe`, `importSongs` messaging contract) verbatim and verify with Node test importing demo lines covering `Artista - Titulo`, `,`/`;`/tab, header skip, numbering strip, dedupe diacritics
- [x] 3.3 Extract `js/draw.js` (`secureIndex` rejection sampling + commit-before-render handler; keep biased `draw()` only as commented reference or remove per IN-04 note without behavior change) and verify with Node uniformity smoke + `spinning` guard test
- [x] 3.4 Create `js/store.js` persistence stub (`save`/`load`/`clear` no-op seam for C-06) and verify with Node test proving the seam exists and `app.js` load order is unaffected
- [x] 3.5 Extract `js/public.js` (public render from `publicHTML()` markup) + `js/app.js` (operator bootstrap: all `getElementById` wiring, `sampleBtn` demo 12, `exportLog` BOM CSV, `fileInput` TXT/CSV/TSV + PDF/DOCX CDN fallback messaging, `copyResult`/`skipResult`) and verify with Node load tests plus zero console errors on `index.html` double-click

## 4. Standalone public screen

- [x] 4.1 Create `public.html` standalone (same markup/styles as `publicHTML()`, no `document.write`) and verify by double-clicking `public.html` directly showing waiting state with no console errors
- [x] 4.2 Rewire `openPublic` to `window.open('public.html','musicBingoPublic',…)` + `setTimeout(broadcast,250)` + blocked-popup alert and verify by triggering open, refocus-if-open, and blocked-popup message paths

## 5. Portable harness (Node + browser mirror)

- [x] 5.1 Add `tests/*.test.js` on `node:test` + `node:assert/strict` (per-module load for each `js/*.js`, import parsing cases, `secureIndex` bounds, no-`document.write` assertion, no-`type="module"` assertion) and verify with `node --test tests/` passing offline with zero installs
- [x] 5.2 Add `tests.html` mirror running the same checks by double-click and verify by opening via `file://` showing per-module pass/fail with no console errors

## 6. Demo asset + docs

- [x] 6.1 Add `assets/lista-ejemplo.csv` (12 anonymized rows: `,`/`;`/tab + `Artista - Titulo`, diacritics, one header line to skip) and verify by importing offline yielding 12 songs with duplicates-reported-not-silent
- [x] 6.2 Write `docs/ESTRUCTURA.md` (file map, script load order, global ownership, monolith-reference note, `npx serve` fallback) and verify every listed path opens/loads as documented
- [x] 6.3 Write initial `docs/PRE_SHOW_CHECKLIST.md` (projector, popups, VDJ-manual audio, offline drill, pre-export, Chrome+Edge smoke) and verify each step is executable by double-click with no network

## 7. Integration gate (promotion blocker)

- [x] 7.1 Run full gate: `node --test tests/` green + `tests.html` double-click green + `index.html`/`public.html` double-click visual parity vs. monolith + monolith retained as reference, and verify with dated evidence (command output + checklist sign-off) before any deletion

## 8. Bugfix transporte DJ→pública en `file://` (17/17 previas intactas, reporte: pública sin resultado ni animación)

- [x] 8.1 Reproducir en RED con `tests/transport.test.js` (AAA, `node:test` + `node:assert/strict`, cero installs): `TRANSPORT_KEY`/`isStateMessage`/`parseTransportValue` ausentes en `js/public.js`, sin listener `storage` ni hidratación en `buildPublicHTML()`, sin `buildStateMessage`/`writeTransport` en `js/app.js` — 4 fail / 1 pass (solo paridad builder≡archivo pasaba)
- [x] 8.2 Fix mínimo dual-transport misma interfaz `{type:'state',...}`: `js/app.js` expone `TRANSPORT_KEY`/`buildStateMessage()`/`writeTransport(msg, storage)` (espejo `localStorage` con `_ts`+`_nonce` para que el evento `storage` dispare aun con estado idéntico) y `broadcast()` lo usa además del `BroadcastChannel`; `js/public.js` expone `TRANSPORT_KEY`/`isStateMessage`/`parseTransportValue` y su `buildPublicHTML()` refactoriza el inline a `handleState(d)` compartido + listener `storage` + hidratación `getItem` al abrir, manteniendo canal primario, markup y CSS idénticos
- [x] 8.3 Regenerar `public.html` desde `buildPublicHTML()` y verificar `EQUAL=true` (test `public.html es identico al builder`); GREEN: 25 pass / 0 fail vía `cmd /c node --test tests/*.test.js` (20 base + 5 nuevas)
- [x] 8.4 Espejo `tests.html`: nuevo check `transporte DJ->publica con fallback file://` + lista de archivos Node actualizada con `tests/transport.test.js`; sin `document.write`, sin `type="module"`, scripts clásicos (gates de `structure.test.js` siguen verdes)
- [x] 8.5 Dictamen alcance: la "animación de ruleta" en la pública NO pertenece a este fix — ni el monolito la tenía (solo `.pop`; el `.spin` vive solo en el operador) — la reveal en 2 fases con `REVEAL_DELAY_MS=3000` es de C-08; este fix restaura paridad funcional (resultado/estado visible en `file://`); `proposal/design/specs` sin cambios (misma interfaz de mensaje, misma UI)

## 9. Bugfix nivel 2: publica muerta por SyntaxError en inline (waiting + disponibles 0)

Causa raiz: el `<script>` inline de `public.html` (generado por `buildPublicHTML()` en `js/public.js:13`) tenia `'[c)'` en vez de `'[c])'` dentro de `esc` — faltaba el `]` de cierre del acceso computado. Un bloque clasico con SyntaxError no ejecuta NADA: sin `handleState`, sin listeners (`BroadcastChannel`/`storage`), sin hidratacion. La pagina quedaba en su pintura estatica (waiting + "Canciones disponibles: 0") para siempre. Shape, keys, ids y orden de scripts estaban bien; el transporte tambien (verificado con harness). Los 25/25 no la atraparon porque solo hacian substring-matching sobre el builder y nunca parseaban el inline; la paridad builder≡archivo comparaba dos strings igualmente rotos.

- [x] 9.1 RED con `tests/public-inline.test.js` (AAA, `node:test` + `node:assert/strict` + `node:vm`, cero installs): `new vm.Script(inline)` lanzaba `SyntaxError: Unexpected token ')'`; el harness (DOM minimo + handlers `storage`/hidratacion reales) no pintaba — 5 fail / 1 pass (solo paridad builder≡archivo pasaba)
- [x] 9.2 Fix minimo de un char en `js/public.js` (`}[c))}function` → `}[c]))}function`) + `public.html` regenerado desde `buildPublicHTML()` con gate de parseo en el script de aplicacion; el barrido encontro el MISMO typo en `index.monolith.html` (su `publicHTML()` de popup: `}[c))}window` → `}[c]))}window`, el panel DJ del monolito usaba otro `esc` sano — por eso el "baseline ok" no lo vio) con su propio gate de parseo de bloques; GREEN: 32 pass / 0 fail (`core+draw+import+store+structure+transport+public-inline`, archivos explicitos)
- [x] 9.3 Espejo `tests.html`: nuevo check `public.html inline parsea` con `new Function(codigo extraido)` (split anti-`</script>` para no romper el HTML) + assert de `'[c]))}'`; sin `document.write` nuevo, sin `type="module"`
- [x] 9.4 Nota para archive (NO toca proposal/design/specs): la red de este change ahora exige parseo real del inline, no solo substrings; C-08 (reveal 2 fases) y C-11 (lock) heredan el harness de `tests/public-inline.test.js` como patron para validar su JS de publica

## Workflow follow-up

- Run `openspec validate --change c-01-foundation-multifile` and fix any warnings before review.
- When ready, run `/opsx-apply` (separate request — this proposal makes no code edits).
