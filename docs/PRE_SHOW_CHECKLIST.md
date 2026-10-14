# PRE-SHOW CHECKLIST — Music Bingo DJ (C-11 consolidado: drill firmado = show-ready)

Todo ejecutable por doble-click, sin red (salvo PDF/DOCX que avisa fallback).
Dueño del drill: operador en la máquina del evento (Chrome/Edge, red apagada).
Sin reporte del operador + checklist firmado NO hay pass.

- [ ] 1. Chrome + Edge smoke: doble-click `index.html` → panel carga, sin errores consola (F12).
- [ ] 2. Doble-click `public.html` → muestra `ESPERANDO EL SORTEO` + `¡Preparados para jugar!`, sin errores.
- [ ] 3. Doble-click `tests.html` → 6/6 PASS, sin errores consola. Equivalente Node:
      `node --test tests/core.test.js tests/import.test.js tests/draw.test.js tests/store.test.js tests/structure.test.js`
- [ ] 4. Proyector: click `▣ Abrir pantalla pública` → abre `public.html`; mover al proyector/2ª pantalla. Si bloquea popup → permitir popups para el archivo y reintentar. Si la pública muestra el aviso de navegador → abrirla en Chrome/Edge actualizado (sin BroadcastChannel ni almacenamiento no hay sincronía).
- [ ] 4b. Pantalla diferida (C-08): sortear 1 → la pública muestra `Buscando el tema en cabina…` SIN el título durante la ruleta + ~3 s de buffer (tiempo de buscar/cargar el tema en VirtualDJ manual) → luego revela el mismo título del operador con igual contador e historial reciente. Offline: el buffer funciona sin red (canal + espejo local).
- [ ] 5. Offline drill: desconectar red → importar `assets/lista-ejemplo.csv` → 12 canciones, mensaje con duplicados (no silencioso). Sortear 1 → rueda gira, resultado comprometido antes de animación.
- [ ] 6. VDJ manual + audio: resultado sorteado → buscar/cargar manual en VirtualDJ (el panel NO controla VDJ en v1) → probar audio y archivos musicales.
- [ ] 6b. Re-sync post-recarga (C-06 + C-08): con la pública abierta, recargar el panel → banner `Partida recuperada…` → reabrir/actualizar la pública → muestra el estado vigente (sin títulos fantasma de sorteos anulados por vaciar/reiniciar a mitad de giro o buffer).
- [ ] 6c. Confirmar/anular offline (C-09): tras 1 sorteo revelado → `✓ Marcar reproducida` cierra en `played`; sortear otra → `Anular por incidencia` exige motivo (vacío/cancelar aborta sin mutar) → lista muestra `Anulada — {motivo}`, historial con motivo, excluida del pool; `Copiar título y artista` no muta estado. Recargar → motivo sobrevive (banner `Partida recuperada…`).
- [ ] 7. Pre-export: click `Exportar historial` → CSV con BOM abre en Excel; columnas Nº/Título/Artista/Estado/Hora/Motivo (celdas que empiezan con `=+-@` se exportan como texto con prefijo `'`).
- [ ] 7b. Fin día 1 (evento 2 días, C-10): click `Exportar historial` → guardar `music-bingo-historial.csv` como evidencia del día 1 (incluye motivos de anulación) antes de apagar; el día 2 continúa sobre la misma partida y se exporta de nuevo al cierre.
- [ ] 8. Reintento file://: si algo falla, comparar con `index.monolith.html` (referencia) y reportar; fallback solo si hace falta: `npx serve .`.
- [ ] 9. Candado de sesión (C-11, grupo 4.5): con la partida bloqueada (`locked` tras el primer sorteo), intentar pegar texto / demo / archivo / `Editar` / vaciar / reiniciar → todo rechazado con `Lista bloqueada. Usá el Desbloqueo administrativo (C-11) para modificar el listado.`, sin mutar nada. Botón `Desbloqueo administrativo` visible solo bloqueado: motivo vacío/cancelado aborta, una confirmación declinada aborta, motivo + doble confirm desbloquea → historial muestra `Desbloqueo administrativo — {motivo}`, editar vuelve a funcionar. Recargar → `locked=false` + entrada intacta (banner `Partida recuperada…`); exportar → fila unlock presente en columna Motivo.
- [ ] 10. Persistencia día-1 → día-2 (C-11, grupos 4.4–4.6): exportar historial al cierre del día 1, cerrar todo, abrir el día 2 → banner `Partida recuperada…` con canciones, historial, motivos y unlock intactos; exportar de nuevo al cierre (6 columnas, BOM, celdas `'=+-@` como texto).
- [ ] 11. Contingencia offline CDN (C-11): PDF/DOCX requieren internet (pdf.js/mammoth progresivos); sin red el mensaje visible indica pegar el texto y usar `Pegar texto` — probado en el drill con red apagada. Ningún otro paso del show requiere red.

Firmado: __________ Fecha: __________ Navegadores probados: __________
