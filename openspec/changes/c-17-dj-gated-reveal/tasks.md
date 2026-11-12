# Tasks: c-17-dj-gated-reveal

> Nota: Q1/Q2 de design.md (copy neutro exacto, ubicación del botón) son diferibles al apply — no cambian specs ni enfoque.

## 1. Gate flag + predicado (TDD)

- [x] 1.1 Test RED: tras el commit hay gate pendiente (`isAwaitingGate()` true, `isPublicBuffer()` false, sin timer de 5 s corriendo) y el commit (status/current/history/lock) existe antes del primer mensaje de espera
- [x] 1.2 Implementar flag `awaitingGate` en `js/app.js` (set en `handleDrawClick` post-commit, consume síncrono en el gate, cancel en vaciar/reiniciar) + `isAwaitingGate()` exportado y verificar que el test 1.1 pasa

## 2. Espera neutra en pública (TDD)

- [x] 2.1 Tests RED en `js/public.js`: fase `awaiting-gate` no muestra título/artista/scroll/tapa comprometida (placeholder neutro), mensaje neutro distinto del cabin message del buffer, re-sync mid-gate no filtra nada, markup escapado
- [x] 2.2 Implementar renderer `awaiting-gate` en `js/public.js` (ventana estática, sin timer) + `buildStateMessage('awaiting-gate')` en `js/app.js` (sin `scrollPool`, current scrubbed título/artista/`coverUrl`) y verificar que los tests 2.1 pasan
- [x] 2.3 Espejar el renderer en `public.html` (idéntico a `buildPublicHTML` por convención) y verificar paridad abriendo ambas en `file://`

## 3. Botón Revelar en pública + arranque del buffer (TDD)

- [x] 3.1 Tests RED: botón visible/habilitado solo con gate pendiente (oculto/deshabilitado sin gate); doble pulsación corre un solo buffer y un solo reveal; el gate no muta commit/history/lock ni agrega entradas
- [x] 3.2 Implementar botón `Revelar en pública` en dashboard (`js/app.js`: habilitación por `isAwaitingGate()`, handler consume-gate → construye `scrollPool` fresco → `broadcast('spinning')` → scheduler 5 s existente → `broadcast('reveal')`) y verificar que los tests 3.1 pasan

## 4. Guards gate+buffer y cancelación (TDD)

- [x] 4.1 Tests RED: Sortear otra + Confirmar (played/void) sin efecto mid-gate y mid-buffer, habilitados al reveal; vaciar/reiniciar mid-gate cancelan el gate (sin reveal posterior); sin reveals fantasma ni pisados (máximo un reveal por commit)
- [x] 4.2 Re-key de predicados de botones y guards en `js/app.js` (`isAwaitingGate() || isPublicBuffer()`, sin otro término) y verificar que los tests 4.1 pasan

## 5. Persistencia del gate (TDD)

- [x] 5.1 Tests RED: refresh mid-gate restaura resultado en dashboard + botón habilitado + pública en espera neutra; snapshot pre-change (sin flag) hidrata como sin gate; gate cancelado persiste como cancelado
- [x] 5.2 Persistir flag aditivo en `js/store.js` (`mbdj.v1`, sin bump de `schemaVersion`, hydrate-default false; reconciliar con `schemaVersion: 2` si C-16 archiva primero) y verificar que los tests 5.1 pasan

## 6. Compat tapas C-16 + CSV (TDD)

- [x] 6.1 Tests RED: `awaiting-gate` y `scrollPool`-pre-gate scrubean `coverUrl` (slot neutro hasta el reveal); export post-gate sigue en 6 columnas (`Nº,Título,Artista,Estado,Hora,Motivo`) sin columna de gate y con 1 fila por sorteo
- [x] 6.2 Verificar scrub con el helper existente de `js/app.js` + export intacto y verificar que los tests 6.1 pasan

## 7. Integración pre-show

- [x] 7.1 Correr la suite completa (base 295 + nuevos) hasta verde y verificar cero skips/exclusiones nuevas
- [ ] 7.2 Smoke `file://` offline (gate manual como C-15 §6.2/§8.3): dashboard + `public.html` popup, sortear→espera neutra→revelar→scroll 5 s→reveal→confirmar→exportar, refresh mid-gate, popup abierto mid-gate, cero CDN en path público — firma del operador [MANUAL-PENDIENTE: exige navegador/`file://` real con doble ventana]
- [x] 7.3 Validar el change (`cmd /c "openspec validate --change c-17-dj-gated-reveal --strict"`) hasta verde

## Workflow follow-up

- Archivarlo con `/opsx:archive c-17-dj-gated-reveal` tras aprobación explícita del operador (sync specs + cierre).
- Aplicar solo con v1 show-ready intacto como base (C-11) y C-16 reconciliado (tapas/scrub/store).
