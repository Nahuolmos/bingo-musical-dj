# Proposal: c-17-dj-gated-reveal

## Why

El operador quiere ver la canción sorteada en privado ANTES de que la pública anime: hoy (C-15) el commit dispara solo el buffer word-scroll 5 s (`REVEAL_DELAY_MS=5000`, ticker 120 ms) y luego el reveal, sin pausa manual para ubicar el tema en VirtualDJ. El gate manual le da ese control: sortea → ve el resultado en su dashboard → cuando está listo pulsa mostrar → recién ahí la pública anima/scrollea + reveal.

## What Changes

- **Sortear ya no dispara la animación pública**: `handleDrawClick` commitea (`pickAndCommit`, commit-before-render intacto) → pinta título+artista+copiar en dashboard → emite fase de espera neutra a la pública (sin scroll ni título) y arma el gate pendiente. El timer de 5 s NO arranca en el commit.
- **Nuevo botón `Revelar en pública` (solo dashboard)**: visible/habilitado solo con gate pendiente (`isAwaitingGate()`); al pulsarlo se emite el buffer word-scroll 5 s con `scrollPool` + al vencimiento el `reveal` (lógica actual C-15 reutilizada sin cambios de timing).
- **Pública en espera neutra hasta el gate**: fase nueva `awaiting-gate` (título-free, sin scroll, placeholder neutro incl. tapa C-16, mensaje de espera distinto de "Buscando el tema en cabina…"); el scroll 5 s + reveal solo corren tras el gate. Re-sync/popup abierto mid-gate recibe espera neutra, nunca el título.
- **Guards extendidos al gate**: Sortear otra / Confirmar (played/void, C-09) / Vaciar / Reiniciar bloqueados o con semántica de gate (ver deltas): sortear-otra y confirmar sin efecto hasta completar reveal; vaciar/reiniciar mid-gate cancelan el gate pendiente (sin reveal fantasma ni pisado).
- **Gate persistente sin timeout**: el gate pendiente (`current` drawn + flag `awaitingGate`) sobrevive a refresh vía store `mbdj.v1` (misma clave, sin bump de schema); no hay auto-reveal ni expiración — el DJ decide cuándo pulsar. `beforeunload`/banner de C-06 cubren el estado pendiente sin cambios de copy salvo lo especificado.
- **Compat preservada**: tapas C-16 (`coverUrl` scrubbed en espera neutra y en `scrollPool` solo tras el gate para la imagen del reveal), CSV 6 columnas intacto (sin columna de gate), identidad La Pepa intacta, offline/`file://`/`<script>` clásicos intactos, VirtualDJ sigue manual.

## Capabilities

### New Capabilities

(none — behavior changes attach to existing capabilities)

### Modified Capabilities

- `public-screen`: espera neutra `awaiting-gate` título-free sin scroll hasta el gate manual; scroll 5 s + reveal solo post-gate; mensaje de espera propio; scrub de tapa hasta el gate.
- `draw-no-repeat`: commit instantáneo en dashboard intacto; draw/confirm lock re-scoped del buffer al gate+buffer (sortear-otra bloqueada hasta reveal completo); sin reingreso.
- `confirm-void`: confirmación played/void bloqueada durante el gate pendiente además del buffer; habilitada solo tras el reveal (mismo motivo obligatorio).
- `session-persistence`: el gate pendiente (`awaitingGate` + `current` drawn) persiste en `mbdj.v1` y restaura el botón/espera tras refresh; cancelación mid-gate persiste como cancelado.

## Impact

- Code: `js/app.js` (gate flag, botón `Revelar en pública`, `buildStateMessage('awaiting-gate')`, guards re-keyed, schedule del buffer movido al gate), `js/public.js` + espejo `public.html` (fase `awaiting-gate` neutra, scroll solo post-gate), `js/store.js` (persistencia del flag sin bump), `js/draw.js` (sin cambios de motor; guards coherentes).
- Specs: `public-screen`, `draw-no-repeat`, `confirm-void`, `session-persistence` (4 deltas MODIFIED; `draw-engine` intacto — sin maquinaria nueva).
- Tests: suite 295/295 + nuevos de gate (espera neutra sin título/scroll/tapa, botón solo con gate, guards gate, persistencia mid-gate, no doble-reveal, popup mid-gate); tolerancia 500 ms del reveal intacta (sigue midiendo desde el gate, no desde el commit).
- No-ops: `draw-engine` (motor/`secureIndex` intactos), `history-export` (6 columnas, 1 entrada por sorteo — el gate no agrega filas), `session-lock`, identidad La Pepa, offline-first.
