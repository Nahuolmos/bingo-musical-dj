# PRE-SHOW CHECKLIST — Music Bingo DJ (C-01 inicial)

Todo ejecutable por doble-click, sin red (salvo PDF/DOCX que avisa fallback).

- [ ] 1. Chrome + Edge smoke: doble-click `index.html` → panel carga, sin errores consola (F12).
- [ ] 2. Doble-click `public.html` → muestra `ESPERANDO EL SORTEO` + `¡Preparados para jugar!`, sin errores.
- [ ] 3. Doble-click `tests.html` → 6/6 PASS, sin errores consola. Equivalente Node:
      `node --test tests/core.test.js tests/import.test.js tests/draw.test.js tests/store.test.js tests/structure.test.js`
- [ ] 4. Proyector: click `▣ Abrir pantalla pública` → abre `public.html`; mover al proyector/2ª pantalla. Si bloquea popup → permitir popups para el archivo y reintentar.
- [ ] 5. Offline drill: desconectar red → importar `assets/lista-ejemplo.csv` → 12 canciones, mensaje con duplicados (no silencioso). Sortear 1 → rueda gira, resultado comprometido antes de animación.
- [ ] 6. VDJ manual + audio: resultado sorteado → buscar/cargar manual en VirtualDJ (el panel NO controla VDJ en v1) → probar audio y archivos musicales.
- [ ] 7. Pre-export: click `Exportar historial` → CSV con BOM abre en Excel; columnas N°/Título/Artista/Estado/Hora.
- [ ] 8. Reintento file://: si algo falla, comparar con `index.monolith.html` (referencia) y reportar; fallback solo si hace falta: `npx serve .`.

Firmado: __________ Fecha: __________ Navegadores probados: __________
