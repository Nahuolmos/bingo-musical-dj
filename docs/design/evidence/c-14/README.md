# Evidencia visual C-14 — pendiente de captura manual (gate de archivo)

Esta carpeta es el gate de archivo de `c-14-public-visual-la-pepa` (tarea 4.2).
El agente no tiene proyector aquí: la captura y la firma las hace el operador.

## Qué capturar (3 estados, pantalla grande o proyector real, a distancia)

1. `idle.png` — pública recién abierta (`public.html` doble clic): marco crema sobre rojo,
   logo La Pepa arriba, vinilo + carátula `?` en el centro, `¡Preparados para jugar!`.
2. `spinning.png` — operador sortea (panel DJ → Sortear): vinilo girando, `SORTEANDO…`,
   mensaje `Buscando el tema en cabina…`, SIN título visible.
3. `reveal.png` — tras ~3 s (+ giro): título crema gigante + artista + carátula con inicial
   + pills de recientes + contador. Verificar legibilidad a distancia.

## Cómo

1. Abrir `index.html` por doble clic (Chrome/Edge), cargar demo (12 canciones).
2. Abrir `public.html` por doble clic (segunda ventana/pantalla, ideal proyector).
3. Capturar `idle.png`. Sortear → capturar `spinning.png` (dentro de los ~3 s).
4. Esperar el reveal → capturar `reveal.png`.
5. Verificar: sin errores en consola (F12), cero requests de red (offline), contraste
   crema/rojo legible a distancia. Si algo no se lee, REPORTARLO (governance MEDIUM:
   no asumir) y no archivar.
6. Guardar los 3 PNG en esta carpeta y avisar al agente para `/opsx:archive c-14-public-visual-la-pepa`.

## Checks automáticos ya verdes (no sustituyen la captura)

- `node --test tests/*.test.js` → 232/232 (contratos C-08 intactos + identidad C-14).
- `grep "http" public.html js/public.js` → vacío (cero CDN).
- Contraste crema/rojo 5.41:1 ≥ 4.5:1 (cálculo en `design.md`).
