# Design — c-14-public-visual-la-pepa

## Final hex — checkpoint apply (C-14)

Tokens fijados en el `<style>` inline de la pública (`:root`):

- `--pepa-red: #B91C1C` (fondo pleno, muestreado de `typography-reference-1/2.jpg` ≈ rojo pleno cálido)
- `--pepa-cream: #F3EAD8` (marco / texto sobre rojo)
- `--pepa-gold: #E8B04B` (SOLO acentos no-textuales: etiqueta del vinilo; NO texto sobre rojo)
- `--pepa-ink: #2B1210` (texto sobre crema: pills recientes)

Contraste verificado (WCAG, cálculo relativo): crema `#F3EAD8` sobre rojo `#B91C1C` = **5.41:1 ≥ 4.5:1** en título (PASS).
Oro `#E8B04B` sobre rojo = 3.31:1 (FAIL para texto) → por eso el oro NUNCA se usa en texto,
solo en la etiqueta central del vinilo con tinta `--pepa-ink` encima. Pills: tinta sobre crema ≈ 15:1.
Titulares `clamp(34px,6vw,76px)` ≥ pisos C-08; `prefers-reduced-motion` desactiva giro + pop.
Sin pipeta instrumental en esta estación: hex = aproximaciones de design confirmadas por cálculo
de contraste + revisión visual pendiente en proyector (gate 4.2 con el operador).

## Context

See proposal.md (Why). Current state: `public.html` is a standalone page with inline `<style>` (dark radial theme, conic-rainbow `.stage`/`.wheel` ruleta, `.brand` "OLMOS NAHUEL PRESENTA · MUSIC BINGO"); `js/public.js` `buildPublicHTML()` returns a verbatim copy of that markup (single-line template literal, asserted by `tests/public-inline.test.js`); `js/app.js` owns `buildStateMessage(phase)` + `REVEAL_DELAY_MS=3000` + buffer timers — none of which this change touches. References: `docs/design/references/referencia-página-pública.png` (target layout), `typography-reference-1/2.jpg` (red/cream + dual type), `Logo-La-Pepa.svg` (real logo, black-fill vector paths on transparent).

## Goals / Non-Goals

**Goals:**
- Re-skin pública to La Pepa identity with named CSS tokens + dual type stack, keeping the C-08 wire contract (`{type:'state',phase,songs,history,current,total,remaining,drawn}`) byte-identical in shape.
- Keep `public.html` standalone + `buildPublicHTML()` verbatim (single source edited twice, test-guarded) and `file://` offline-first.
- Preserve projector legibility (sizes ≥ current `clamp()` floors) and read-only contract.

**Non-Goals:**
- No logic changes (no timer, phase, broadcast, store, or operator UI edits); no new capabilities beyond visual; no VirtualDJ integration; no cartones/stats (C-12 descartado).

## Decisions

1. **Tokens CSS nombrados en el `<style>` inline de la pública (no en `css/styles.css`).**
   - Rationale: la pública es standalone y debe abrirse sola por doble clic; su estilo vive inline hoy y los tests lo asertan inline. Moverlo a stylesheet externo rompería `public.html` aislado.
   - Tokens: `--pepa-red` (fondo pleno, muestreado de referencias ≈ `#B91C1C` a confirmar por pipeta en apply), `--pepa-cream` (marco/texto ≈ `#F3EAD8`), `--pepa-gold` (acento tipográfico ≈ `#E8B04B`), `--pepa-ink` (texto sobre crema). Alternative rejected: reutilizar `--red:#ef3948` del operador — es otro rojo (neón) y acoplaría dos superficies con contratos distintos.
   - Checkpoint apply: fijar hex finales por pipeta de las 3 imágenes + verificar contraste crema/rojo ≥ 4.5:1 en título.

2. **Tipografía: sistema primero, vendor solo como mejora opt-in (decisión Checkpoint 1).**
   - Default: stack sistema — titulares `Impact, 'Arial Narrow Bold', 'Franklin Gothic Heavy', sans-serif` (condensado bold evocando el bloque de `typography-reference-1`) + acentos `Segoe Print, 'Comic Sans MS', cursive` solo para micro-acento manuscrito (nunca titulares). Cero red, cero `vendor/`, fallback trival.
   - Opt-in: si el operador aporta woff2 con licencia, vendorizar en `vendor/fonts/` + `@font-face` local con el mismo fallback; mismo patrón probado que SheetJS en C-05. Alternative rejected: Google Fonts / CDN — viola RN-X-01 y la regla dura 3.
   - Propuesta deja la decisión default=sistema; apply la confirma con screenshot comparativo.

3. **Layout por zonas con IDs/clases estables (contrato DOM para tests).**
   - Estructura: `.pepa-frame` (marco crema) > `.pepa-logo` (arriba, `<img src="assets/Logo-La-Pepa...">` + fallback texto), `.pepa-stage` (centro: `.pepa-cover` estática + `.pepa-vinyl` que gira solo en `spinning` via clase `.spin`), `#title/#artist` (abajo, mismos IDs), `#history` pills + `#count` (mismos IDs, reestilizados). IDs de estado (`#status,#waiting,#result`) preservados para no romper listeners.
   - Alternative rejected: reescribir con grid nombrado nuevo e IDs nuevos — rompería tests espejo y el listener `storage`/`BroadcastChannel` de la pública.

4. **Logo: convertir SVG a asset proyector-seguro.**
   - El SVG versionado es vector negro (paths `fill #000`) pensado para fondo claro; sobre rojo pleno necesita versión crema/blanca. Plan: en apply, generar `assets/logo-la-pepa-crema.svg` (mismos paths, `fill` → crema) o `<img>` con filtro CSS `invert/brightness`; original intacto. Fallback texto "BODEGÓN LA PEPA" si el asset falta.
   - Alternative rejected: embeber el SVG negro tal cual — invisible sobre rojo.

5. **Vinilo CSS puro, sin assets binarios.**
   - `.pepa-vinyl`: círculos concéntricos via `repeating-radial-gradient` + etiqueta naranja central (eco de la referencia), animación `spin` solo con clase `.spin` (respeta `prefers-reduced-motion`). Alternative rejected: PNG/JPG de vinilo — peso + `file://` paths frágiles.

## Risks / Trade-offs

- [Riesgo] Crema sobre rojo no alcanza contraste a distancia → Mitigación: tamaños ≥ `clamp()` actuales, pesos 900 en titulares, verificación screenshot en proyector real (tarea manual, gate de archivo).
- [Riesgo] `buildPublicHTML()` diverge de `public.html` (verbatim drift) → Mitigación: test `public-inline.test.js` existente + nueva aserción de tokens; edición en un solo paso con diff.
- [Riesgo] Logo crema mal convertido (trazos finos ilegibles) → Mitigación: fallback texto + revisión visual con el operador antes de archivar.
- [Trade-off] Sistema-first resigna fidelidad tipográfica exacta a cambio de cero-riesgo offline; vendor queda como follow-up documentado, no bloquea.

## Migration Plan

Sin migración: cambio visual puro, sin estado ni schema. Rollback = revert de `public.html` + `js/public.js` (+ `assets/` si se agregó). Deploy = abrir `public.html` por doble clic; sin build.

## Open Questions

- Hex finales exactos (pipeta en apply) — no cambia specs/tasks.
- ¿Vinilo gira también en `reveal` o solo en `spinning`? Default: solo `spinning`; detalle visual deferrable al screenshot.
