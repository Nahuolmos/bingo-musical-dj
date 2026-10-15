# Proposal — c-14-public-visual-la-pepa

## Why

La pantalla pública funciona (C-08: reveal 2 fases, C-11: v1 show-ready) pero mantiene la estética genérica oscura del prototipo (fondo radial `#24121c→#08080c`, ruleta conic multicolor, marca "OLMOS NAHUEL PRESENTA"). El local Bodegón La Pepa tiene identidad propia versionada (rojo pleno + crema, tipografía doble, logo real) y la pública es lo único que el público mira durante horas en el proyector. Vestirla con esa identidad sube el valor percibido del show sin tocar la lógica ya verificada.

## What Changes

- Reskin visual SOLO de la pública (`public.html` standalone + `buildPublicHTML()` espejo en `js/public.js`): fondo rojo pleno + marco crema, LOGO real arriba (hoy placeholder genérico), vinilo + carátula en el centro (según `referencia-página-pública.png`), TÍTULO / ARTISTA / CANCIONES RECIENTES abajo en crema.
- Tokens CSS nombrados para la paleta La Pepa (rojo fondo, crema marco/texto, variante dorada tipografía) + stack tipográfico doble (titulares bold condensados + acentos manuscritos) con fallback a sistema; custom vendorizado solo si entra en `vendor/` local con fallback probado (NUNCA CDN en ruta principal).
- Contadores + últimas 5 preservados como datos (mismo snapshot C-08), reestilizados como pills crema sobre rojo legibles a distancia de proyector.
- Fases `spinning` (sin título, mensaje cabina) → `reveal` intactas en comportamiento; solo cambia su vestimenta (animación de giro del vinilo en vez de ruleta conic).
- C-12 (cartones) y C-13 (VDJ spike) se marcan `descartado` en CHANGES.md — este C-14 los reemplaza como foco post-v1.

## Capabilities

### New Capabilities

(none — no new system behavior; visual identity only)

### Modified Capabilities

- `public-screen`: agrega requirements de identidad visual La Pepa (paleta, tipografía, layout con logo/vinilo/caratula, pills recientes) manteniendo los 6 requirements C-08 existentes (reveal 2 fases sin spoiler, `REVEAL_DELAY_MS=3000`, popup lifecycle, read-only, buffer guards, commit-before-render).

## Impact

- Afectados: `public.html` (inline `<style>` + markup), `js/public.js` (`buildPublicHTML()` debe seguir verbatim con `public.html`), posible `vendor/` tipográfico + `assets/Logo-La-Pepa` integrado.
- NO afectados: `js/app.js` (`buildStateMessage`, `REVEAL_DELAY_MS`, timers), `js/draw.js`, `js/core.js`, `js/store.js`, panel operador (`index.html`, `css/styles.css` del operador).
- Tests: extensión de `tests/public.test.js` + `tests/public-inline.test.js` (clases/estructura DOM, tokens CSS, contratos C-08 intactos); espejo `tests.html`; verificación manual smoke `file://` + screenshot en proyector.
- Riesgo principal: legibilidad a distancia y contraste sobre rojo; mitigación con tamaños `clamp()` existentes o mayores + verificación visual en proyector real antes de archivar.
