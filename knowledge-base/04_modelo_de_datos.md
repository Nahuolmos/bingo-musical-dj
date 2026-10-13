# Modelo de Datos

## Dominios

- **Catálogo**: canciones cargadas y su disponibilidad en la partida.
- **Partida / Sorteo**: selección uniforme, compromiso del resultado, animación, confirmación.
- **Historial / Evidencia**: registro auditable + exportación CSV.

Sin base de datos: todo vive en memoria JS durante la sesión (`songs`, `history`, `current`, `spinning`). Se pierde ante refresh/cierre (riesgo P0).

## ERD (Entity Relationship Diagram)

```
Session 1 ── * Song (una partida contiene N canciones)
Session 1 ── * HistoryEntry (un historial ordenado por n)
Song 1 ── 0..1 HistoryEntry (toda entrada referencia una canción;
             canciones available aún no tienen entrada)
current ──> Song | null (sorteada pendiente de confirmar/anular)
```

Estados de `Song.status`: `available` → `drawn` → `played` | `void` (terminal; sin reingreso en v1).
Estados de `HistoryEntry.status`: `drawn` (al comprometer) → actualizado a `played` | `void` al confirmar.

## Entidades

### Song (canción del catálogo en memoria)

- Atributos:
  - `id`: string (`'s' + base36(timestamp) + rand`) — generado por `makeId()`
  - `title`: string (obligatorio, no vacío tras normalizar)
  - `artist`: string (opcional; `''` = "Artista no especificado")
  - `status`: `'available' | 'drawn' | 'played' | 'void'`
  - `addedAt`: string ISO (`new Date().toISOString()`)
- Relaciones: referenciada por 0..1 `HistoryEntry` vía `songId`; apuntada por `current` cuando está `drawn` pendiente.
- Constraints:
  - `title` no vacío; líneas vacías se ignoran (`normalizeLine` retorna `null`).
  - Dedupe por clave normalizada `lowercase + NFD sin diacríticos + espacios colapsados` de `title|artist` (función `dedupe()`); duplicados omitidos con conteo visible, no silencioso.
  - Prefijos de numeración (`1.`, `2)`, `-`, `*`) eliminados; separador artista/título: `\s+[—–-]\s+` (primera parte = artista, resto = título).
  - CSV/TSV: si la línea trae `,`/`;`/tab con ≥2 celdas, celda[0]=artista, resto=título (salvo URLs `http`); primera fila tipo encabezado (`titulo/cancion/song/track` + separador) se salta.
- Índices relevantes: ninguno (búsqueda lineal `filter()` + `available()`; volúmenes de evento < 1000 filas, suficiente).

### HistoryEntry (registro auditable en memoria)

- Atributos:
  - `n`: number correlativo (`history.length + 1`)
  - `id`: string = `songId` de referencia
  - `title`: string (snapshot al momento del sorteo)
  - `artist`: string (snapshot)
  - `status`: `'drawn' | 'played' | 'void'` (se actualiza in-place vía `findLast`)
  - `time`: string `es-AR HH:MM:SS`
  - `motivo`: ⚠️ **no persistido como campo** — la anulación hoy solo pide `confirm()` genérico sin texto de motivo (brecha vs. brief; ver `10_preguntas_abiertas.md` IN-02).
- Relaciones: N:1 hacia `Song`.
- Constraints: `n` único y monótono; una entrada por compromiso de sorteo; actualización solo `drawn` → terminal.

### Session (partida en memoria, no serializada)

- Atributos: `songs[]`, `history[]`, `current: Song|null`, `spinning: boolean`,视图 `total/remaining/drawn` derivados.
- Relaciones: agregador raíz; se broadcastea como snapshot en cada `render()`.
- Constraints: `current` solo existe con `status==='drawn'`; `spinning` bloquea sorteo y confirmación; `Vaciar lista` / `Reiniciar` exigen `confirm()` (doble si hay historial).

## Seed data inicial

Vacío por defecto ("Todavía no hay canciones cargadas"). Botón **Cargar demo** inserta 12 canciones (`available`):

Shakira – Hips Don't Lie · Los Fabulosos Cadillacs – Matador · Queen – Don't Stop Me Now · Dua Lipa – Levitating · Ráfaga – Mentirosa · Soda Stereo – De Música Ligera · Los Palmeras – El Bombón Asesino · Michael Jackson – Billie Jean · Karol G – Si Antes Te Hubiera Conocido · Vilma Palma e Vampiros – La Pachanga · ABBA – Gimme! Gimme! Gimme! · Daddy Yankee – Gasolina.

**Fuentes**: `index.html` (`normalizeLine`, `parseText`, `dedupe`, `available`, `draw`, `setCurrentStatus`, `sampleBtn`), `docs/PRODUCT_BRIEF.md` §§Flujo/Principios, `discovery/discovery.md` §5.
