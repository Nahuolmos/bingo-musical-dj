# Archive Note — c-14-public-visual-la-pepa

**Archived:** 2026-10-15 → `openspec/changes/archive/2026-10-15-c-14-public-visual-la-pepa/`
**Schema:** spec-driven
**Sync:** MODIFIED `openspec/specs/public-screen/spec.md` (6 requirements C-08 intactos + 4 ADDED de C-14: identidad visual La Pepa, tipografía dual offline, pills recientes, contratos intactos; Purpose y título preservados). `openspec.cmd validate c-14-public-visual-la-pepa --strict` limpio; `openspec.cmd validate --specs --strict` → 12/12.
**Tasks:** 33/33 complete. Los 6 gates manuales (§4.1/§4.2/§5.6/§7.4/§8.4/§9.4) cerrados por aprobación explícita del operador en chat 2026-10-15 ("Quedó, archivamos") con screenshot de reveal en 16:9 (Billie Jean / Michael Jackson, layout lleno, logo top-left, disco limpio, sin eyebrow). PNG no versionados — la evidencia es la aprobación textual. Nota registrada en cada tarea de `tasks.md`.
**Tests:** suite completa 268/268 VERDE (baseline C-11 214 + 54 nuevos C-14: public 34/34 C-08 intactos, inline paridad, cover, visual-fixes §1–§11). `grep http public.html js/public.js` vacío (cero CDN, `file://` offline). `css/styles.css` sin cambios (estilo pública inline por diseño standalone).
**C-12/C-13:** ya marcados descartados en CHANGES.md durante el apply (este C-14 los reemplaza como foco post-v1) — no se tocan en el archive.

## 5 rondas de fixes del operador (post-screenshot, change abierto)

1. **v1 fit + overlap + giro + logo (§5.1–§5.4):** viewport `100vh` sin scroll (clamps `vh` + history `12vh`); sleeve-over-vinyl según referencia (cover `z-index:2` encima, vinilo asoma mitad); gira SOLO el disco (nueva capa `.pepa-grooves`, `#vinyl` ya no rota); logo más grande + glitch del `<img>` roto corregido (`onerror`→`hidden`). Tests §1–§4 (10 nuevos, ROJO→VERDE). Suite 242/242.
2. **v2 textos + disco + centro + PNG (§6.1–§6.4):** título `clamp(40px,6vh,96px)` + artista `clamp(20px,3.5vh,48px)`; "CANCIÓN SORTEADA" fuera del disco (`#status` se limpia en reveal); círculo amarillo centrado geométricamente (grid); logo PNG (`assets/logo-la-pepa.png`) en vez de SVG. Tests §5–§8. Suite 253/253.
3. **v3 logo top-left + XL sin scroll (§7.1–§7.2):** logo `absolute` top-left fuera del flujo (`30vw` ancho, sin solape con stage); título `clamp(56px,9vh,130px)` + artista `clamp(28px,4.5vh,64px)` con compensaciones verticales (nunca recortar texto). Tests §9 (5 nuevos). Suite 258/258.
4. **v4 frame full-height + disco limpio (§8.1–§8.2):** `.pepa-frame{flex:1;space-evenly}` sin tope `1120px` (fin de la franja); `#status` movido bajo el stage como `.status` propio (en el disco se leía "EL SORTEO" recortado); pills `clamp(12px,1.8vh,16px)`. Tests §10 (5 nuevos) + §3 con supersede documentado. Suite 263/263.
5. **v5 sin eyebrow + textos máximos (§9.1–§9.2):** `<div class="pepa-eyebrow">` eliminado sin hueco (`space-evenly` redistribuye ~2vh); título `clamp(64px,10.5vh,144px)` + artista `clamp(32px,5.2vh,72px)` + resto de textos subidos con compensaciones (stage `min(500px,90%)`, cover/vinilo `min(200px,32vw,24vh)`). Tests §11 (5 nuevos). Suite 268/268.

## Implementation touched (verify only, not re-implemented)

- `public.html` + `js/public.js` `buildPublicHTML()` (reskin + 5 rondas, paridad verbatim exacta, regenerado desde el builder)
- `tests/public.test.js` (aserciones identidad §1.1) + `tests/public-inline.test.js` (paridad tokens §1.2)
- `tests/public-cover.test.js` (nuevo, `coverFor` + seam B) + `tests/public-visual-fixes.test.js` (nuevo, §1–§11)
- `assets/logo-la-pepa.png` (nuevo, desde `docs/design/references/logo-la-pepa.png`) + `assets/logo-la-pepa-crema.svg` (nuevo, fill→crema)
- `docs/design/evidence/c-14/README.md` (gate manual, instrucciones de captura) + `docs/design/references/` (referencia + logo + tipografías)
- `tests.html` (harness espejo actualizado)

## Downstream

- Ningún change pendiente consume C-14 (era el foco post-v1 que reemplazó a C-12/C-13). C-08 intacto verificado por suite (2 fases, `REVEAL_DELAY_MS=3000`, sin spoiler, sin controles).
- NOTA para el operador (no commiteado por el agente): en el commit incluir `assets/logo-la-pepa.png`, `assets/logo-la-pepa-crema.svg`, `tests/public-cover.test.js`, `tests/public-visual-fixes.test.js`, `docs/design/evidence/c-14/README.md`, `docs/design/references/` (verificar `git status` — parte ya pusheado en `fe0ad9b`, el resto pendiente). Scripts scratch `fix-*.js`/`sync-*.js`/`write-*.js`/`add-linebreaks.js` en raíz: untracked, NO incluir (limpieza del operador).
