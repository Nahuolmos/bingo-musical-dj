# Flujos Principales

Cada flujo se documenta extremo a extremo. Actores: DJ (operador), PUB (pantalla pública), SYS (index.html), VDJ (VirtualDJ manual, fuera del sistema).

## Flujo 1: Importar y validar la lista oficial

**Disparador**: el DJ tiene la lista (PDF/documento/TXT/CSV o texto).
**Actor**: DJ.

**Pasos**:
1. DJ abre `index.html` en Chrome/Edge; SYS muestra "Esperando listado" y sorteo deshabilitado.
2. DJ elige vía A (archivo) o B (pegar texto) o C (demo para ensayo).
   - A: `fileInput.change` → por extensión: TXT/CSV/TSV directo (`File.text`); PDF vía pdf.js+worker; DOCX vía mammoth; `loadScript` desde cdnjs si hace falta.
   - B: `parsePaste` → `parseText(pasteInput)`; C: `sampleBtn` → 12 canciones fijas.
3. SYS ejecuta `parseText` → `normalizeLine` → `dedupe` (intra + contra lista) y `importSongs` informa "N nueva(s), M duplicado(s)".
4. SYS hace `render()` + `broadcast()`; contadores y lista con filtro quedan visibles.
5. DJ revisa con el buscador; corrige re-importando (los duplicados se omiten) antes de comenzar.

**Casos de error**:
- Archivo incompatible → mensaje "Formato no compatible. Usá PDF, DOCX, TXT o CSV."
- Nada detectable → "No se detectaron canciones. Revisá el formato o pegá el texto manualmente."
- PDF/DOCX sin internet → "No se pudo leer... verificá internet o copiá el texto y usá Pegar texto."
- `.xlsx` real → ⚠️ no aceptado por el input (IN-05); workaround: exportar a CSV o pegar.

## Flujo 2: Sorteo + animación + reproducción (happy path)

**Disparador**: DJ pulsa "Sortear canción".
**Actor**: DJ; audiencia: PUB; ejecución: VDJ manual.

**Pasos**:
1. SYS verifica `!spinning && available().length`; elige `s = pool[secureIndex(pool.length)]` (uniforme, rejection sampling).
2. SYS compromete: `s.status='drawn'`, `current=s`, `history.push({n, id, title, artist, status:'drawn', time})`.
3. SYS inicia animación: clase `spin` (2.7 s), textos "SORTEANDO", deshabilita sorteo/confirmación; `broadcast()` inmediato con `current`.
4. ⚠️ PUB muestra el título al instante (spoiler 2.75 s, IN-03); operador ve "La ruleta está girando… El resultado ya fue elegido".
5. Tras `setTimeout(2750)`: `spinning=false`, revela título/artista en operador (`result.show`), habilita "Marcar reproducida"; `render()` + broadcast.
6. DJ busca y reproduce en VDJ manualmente; al terminar pulsa "Marcar reproducida" → `setCurrentStatus('played')` actualiza canción + entrada (`findLast`), limpia `current`, muestra "Canción registrada".

```
DJ → SYS: clic Sortear
SYS → SYS: secureIndex + commit (status drawn + history)
SYS → PUB: broadcast state (¡inmediato!)
SYS → DJ: animación 2.75s
SYS → DJ+PUB: reveal + render/broadcast
DJ → VDJ: busca y reproduce (manual)
DJ → SYS: Marcar reproducida → played
```

**Casos de error**:
- 0 elegibles → botón deshabilitado + "No quedan canciones disponibles".
- Reinicio/vaciado mid-giro → timeout huérfano que revela un resultado ya borrado (IN-04); exige disciplina operativa hasta corregirse.
- Popup bloqueado → alerta de permitir emergentes (solo afecta a Flujo 4).

## Flujo 3: Anulación por incidencia

**Disparador**: falta el archivo de audio, tema equivocado, pedido del organizador.
**Actor**: DJ.

**Pasos**:
1. Con `current` en `drawn`, DJ pulsa "Anular por incidencia" (o "Copiar título y artista" antes si necesita buscarlo).
2. SYS pide `confirm('¿Registrar como anulada...? Quedará excluida.')`.
3. Confirmado → `setCurrentStatus('void')`: canción e historial a `void`, `current=null`, mensaje "Incidencia registrada... excluida... Informá al organizador."
4. La canción no vuelve a elegible; queda visible como "Anulada" en lista e historial y sale en el CSV.

**Casos de error**:
- ⚠️ Motivo en texto libre no se captura ni persiste (IN-02); hoy la "constancia" es solo el estado `void` + hora.
- Anular sin `current` o durante el giro → botones deshabilitados, sin efecto.

## Flujo 4: Abrir y sincronizar la pantalla pública

**Disparador**: antes del show (paso 02 del flujo recomendado).
**Actor**: DJ.

**Pasos**:
1. DJ pulsa "Abrir pantalla pública" → `window.open('', 'musicBingoPublic', 'popup,...')`.
2. SYS escribe `publicHTML()` (estilos + ruleta + listeners) vía `document.write/close`; `setTimeout(broadcast, 250)`.
3. DJ mueve la ventana al proyector/segunda pantalla; cada `render()` re-emite el snapshot.
4. PUB escucha `BroadcastChannel.onmessage`: actualiza contador ("Disponibles: N · Sorteadas: M"), muestra `current` (título/artista/estado) o "¡Preparados para jugar!", y últimas 5 como pills.

**Casos de error**:
- Bloqueador de popups → `alert('El navegador bloqueó la ventana...')`; habilitar emergentes para archivos locales.
- `BroadcastChannel` ausente (navegador viejo) → `channel=null`, sin sincronización; exigir Chrome/Edge actualizado.

## Flujo 5: Exportar evidencia y cerrar

**Disparador**: fin de la partida o necesidad de constancia.
**Actor**: DJ.

**Pasos**:
1. DJ pulsa "Exportar historial" → CSV `Nº,Título,Artista,Estado,Hora` con comillas RFC + BOM, descarga `music-bingo-historial.csv`.
2. DJ guarda el CSV + conserva copia de la lista oficial.
3. Solo entonces, si corresponde, "Reiniciar partida" (doble `confirm` con historial).

**Casos de error**:
- Historial vacío → CSV solo con encabezado (válido, sin filas).
- Reiniciar sin exportar → el `confirm` lo advierte ("Exportá el historial primero si lo necesitás"), pero no lo fuerza.

## Flujo 6: Vaciado / Reinicio con salvaguardas

**Disparador**: lista equivocada o fin de prueba.
**Actor**: DJ.

**Pasos**:
1. "Vaciar lista" → `confirm()`; si hay historial, segundo `confirm()` para borrar también historial.
2. "Reiniciar partida" → `confirm()` global; borra canciones + historial + `current`, resetea textos y animación.
3. ⚠️ Ninguno bloquea por "partida iniciada" ni cancela el timeout en vuelo (IN-01, IN-04).

**Fuentes**: `index.html` (handlers completos), `docs/PRODUCT_BRIEF.md` §Flujo principal, `docs/ACCEPTANCE_CRITERIA.md`.
