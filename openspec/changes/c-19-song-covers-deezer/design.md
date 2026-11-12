# song-covers-deezer — Diseño

## Cadena de consulta por canción (pre-show)

```
caché IndexedDB
  ↓ miss
Deezer search q="artista título" type=track limit=10
  ↓ nomatch/error
iTunes search term="artista título" entity=song
  ↓ nomatch
iTunes search term="artista" entity=album
  ↓ miss
assets/covers/<artista>-<titulo>.jpg
  ↓ miss
assets/covers/<artista>.jpg
  ↓ miss
assets/covers/<titulo>.jpg
  ↓ miss
coverUrl = null → placeholder C-14
```

## Cambios de código

### `js/import.js`

- Nueva constante `DEEZER_SEARCH_URL = 'https://api.deezer.com/search'`.
- Nueva constante `DEEZER_LIMIT = 10`.
- Nueva función `pickDeezerResult(results, song)`: match exacto-insensible por `title` + `artist.name`; si falla, tier relajado con `baseCoverStr`; si falla, primer resultado.
- Nueva función `singleDeezerAttempt(song, fetchFn, url, timeoutMs)`: igual que `singleCoverAttempt` pero parseando respuesta de Deezer (`data[].album.cover_big` o `cover_medium`). Devuelve `{kind:'artwork',url}` / `{kind:'nomatch'}` / `{kind:'transient'}`.
- `resolveCoverURL(song, fetchFn, opts)` reescrito para encadenar etapas:
  1. `coverCache.get(key)` → si hit, devolver.
  2. `singleDeezerAttempt(...)` → si artwork, cachear (`source:'deezer'`) y devolver.
  3. `singleCoverAttempt(...)` iTunes simple → si artwork, cachear (`source:'itunes-simple'`) y devolver; si nomatch, ir a paso 4.
  4. `resolveAlbumCover(...)` iTunes álbum → si artwork, cachear (`source:'itunes-album'`) y devolver.
  5. `null`.
- `coverArt600` se mantiene para iTunes; Deezer `cover_big` ya es 500x500, se usa tal cual.
- Exportar `DEEZER_SEARCH_URL` y `DEEZER_LIMIT` en `MBDJ.import`.

### `js/app.js`

- `defaultCoverFetch` envuelve `fetch` nativo con proxy CORS fallback: si la petición directa falla (CORS desde `file://`), reintenta vía `https://api.allorigins.win/raw?url=<encoded>`. Solo afecta al fetch real de la app, no a los mocks inyectados en tests.
- `enrichAfterImport` ya pasa `coverCache` a `enrichCovers` (C-18). Deezer se resuelve dentro de `resolveCoverURL`.

### `js/public.js`

- Sin cambios: `coverFor` prefiere `coverUrl` y cae a placeholder; `paintCover` con `onerror` → placeholder.

### Tests

- `tests/song-covers.test.js`: agregar bloques S12–S18. Actualizar test C-16 `deterministic no-match` (ahora son 3 llamadas: Deezer + iTunes simple + iTunes álbum).

## Seams inyectables

- `fetchFn` inyectado (mock en tests, `fetch` real en app).
- `coverCache` inyectable (mock de IndexedDB en tests).

## Invariables (no romper)

- CERO `fetch(` en `buildStateMessage`, `broadcast`, `render`, `schedulePublicReveal`, `draw.js`, `public.js`.
- `REVEAL_DELAY_MS = 5000` intacto.
- `schemaVersion` sigue 2.
- CSV historial 6 columnas intacto.
- `locked` bloquea import y campo manual.

---
