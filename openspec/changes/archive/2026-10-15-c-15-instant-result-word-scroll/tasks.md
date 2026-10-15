# Tasks: c-15-instant-result-word-scroll

> Nota: Q1 de design.md resuelta por opción A — delta `draw-engine` sumado a este change (grupo 7); ya no hay follow-up separado.

## 1. Retune del delay público a 5 s (TDD)

- [x] 1.1 Retunar a 5000 ms todos los tests/escenarios que asertan 3000 (REVEAL_DELAY_MS, reveal-timing, tolerancia 250→500 ms) y verificar que la suite nombra 5000 en cada aserción tocada (`grep -r 3000 tests/ js/ public.html` sin restos)
- [x] 1.2 Cambiar `REVEAL_DELAY_MS` a 5000 en `js/app.js` (única constante) y verificar que el test de constante nombrada + timing ±500 ms pasa

## 2. Resultado instantáneo en dashboard (TDD)

- [x] 2.1 Test RED: sortear pinta título+artista+copiar disponible de inmediato, sin animación de operador ni timeout de operador, y commit-before-show intacto (status/current/history existen antes del primer paint/mensaje)
- [x] 2.2 Implementar `handleDrawClick` inmediato en `js/app.js` (commit → paint resultado → `broadcast('spinning')` → buffer público) y verificar que el test 2.1 pasa
- [x] 2.3 Retirar la maquinaria de giro del operador en `js/draw.js` (`SPIN_MS`, `scheduleReveal`/`cancelReveal`/`isRevealing`, transiciones `spinning=true` del path de sorteo; `pickAndCommit`/`secureIndex`/lock intactos) + re-key de guards a `isPublicBuffer()` en `js/app.js`, y verificar suite verde sin referencias al spin de operador (`grep -ri SORTEANDO js/app.js` sin restos en el path de sorteo)

## 3. Payload scrollPool anti-spoiler (TDD)

- [x] 3.1 Test RED: el mensaje fase `spinning` lleva `scrollPool` con las restantes post-commit y EXCLUYE la sorteada por id (incluye caso colisión: otra restante con igual título sí aparece, la sorteada no)
- [x] 3.2 Extender `buildStateMessage('spinning')` en `js/app.js` con `scrollPool: [{id,title,artist}]` desde `available()` post-commit y verificar que el test 3.1 pasa

## 4. Ticker word-scroll en pública (TDD)

- [x] 4.1 Tests RED en `js/public.js`: `pickScrollItems` nunca devuelve la sorteada, el ticker avanza por pasos, el reveal detiene el scroll y pinta el título real, pool vacío → espera neutra sin título, markup en entradas se escapa
- [x] 4.2 Implementar seams de scroll + renderer del ticker en `js/public.js` (ventana fija, paso ~500 ms con patrón de timers inyectable, `prefers-reduced-motion` → espera estática) y verificar que los tests 4.1 pasan
- [x] 4.3 Espejar el renderer en `public.html` (idéntico a `buildPublicHTML` por convención) + CSS del scroll vertical (system-first, sin red) y verificar paridad visual abriendo ambas en `file://`

## 5. Guards y cancelación en el buffer (TDD)

- [x] 5.1 Tests RED: Sortear + Confirmar (played/void) sin efecto mid-buffer y habilitados al reveal; vaciar/reiniciar mid-buffer cancelan el reveal (sin reveals fantasma ni pisados: como máximo un reveal por commit)
- [x] 5.2 Ajustar predicados de botones y guards en `js/app.js` (solo `isPublicBuffer()`, sin término `spinning`) y verificar que los tests 5.1 pasan

## 6. Integración pre-show

- [x] 6.1 Correr la suite completa (base 268 + nuevos) hasta verde y verificar cero skips/exclusiones nuevas
- [x] 6.2 Smoke `file://`: dashboard + `public.html` como popup, sorteo→scroll 5 s→reveal→confirmar→exportar, sin internet y sin referencias CDN en el path público (`grep -r cdnjs public.html js/public.js` vacío) — OK operador 2026-10-15 ("Perfecto así, archiva")

## 7. Delta draw-engine plegado (opción A, sin código)

- [x] 7.1 Verificar que `specs/draw-engine/spec.md` existe como MODIFIED con los títulos de requirements/escenarios originales intactos (`Cancellable reveal timeout with fixed spin base`, `Spinning guard blocks draw and confirm`, más sus 5 escenarios) y cuerpos reescritos: sin maquinaria de giro ni base 2750 ms en dashboard, guards cancelables re-keyed al buffer 5 s (coherente C-03/C-11)
- [x] 7.2 Re-validar el change (`openspec.cmd validate c-15-instant-result-word-scroll`) hasta verde y verificar que design §6 + Q1 resuelta y este grupo cubren el delta

## 8. Ajuste ticker rápido 500→120 ms (apply, change sigue ABIERTO, no archivar)

- [x] 8.1 Retunar `SCROLL_STEP_MS` 500→120 en `js/public.js` (seam exportado + inline del builder) con rationale en comentario: dos timings separados y nombrados (paso ticker vs `REVEAL_DELAY_MS=5000` total intacto, reveal sigue a los 5 s); `prefers-reduced-motion` intacto (espera estática, sin timer)
- [x] 8.2 Regenerar `public.html` verbatim desde `buildPublicHTML()` (paridad exacta, test `sin drift` verde) + retunar tests timing (`tests/public.test.js`: constante 120, separación paso-vs-buffer, paso programado ±30 ms; `tests.html`: paso 120); suite completa + `openspec validate` verdes, cero CDN
- [x] 8.3 Re-smoke visual del operador en `file://` (ticker rápido 5 s → reveal) — OK operador 2026-10-15 ("Perfecto así, archiva")

## Workflow follow-up

- Q1 cerrada (opción A): no hay follow-up separado; el archive incluye los tres deltas (`draw-no-repeat`, `public-screen`, `draw-engine`).
