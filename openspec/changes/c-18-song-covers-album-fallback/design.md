# song-covers-album-fallback — Diseño

## Cadena de fallback (por canción, pre-show)

```
1. iTunes artista+título (C-16 existente)        → coverUrl del sencillo
   ↓ si no hay match usable
2. iTunes artista solo → álbum (NUEVO)           → coverUrl del álbum
   ↓ si no hay red o falló online
3. assets/covers/<artista>-<titulo>.jpg          → coverUrl local sencillo
   ↓ si no existe
4. assets/covers/<artista>.jpg                   → coverUrl local álbum artista
   ↓ si no existe
5. assets/covers/<album>.jpg                     → coverUrl local álbum
   ↓ si no existe
6. coverUrl = null                               → placeholder C-14 (siempre)
```

## Cambios de código

### `js/import.js`

- `resolveCoverURL(song, fetchFn, opts)`: después de que el intento 1 (artista+título) resuelva `nomatch`, lanzar intento 2 con `term=encodeURIComponent(artist)` + `&entity=album&media=music`. Elegir el primer álbum cuyo `collectionName` contenga palabras clave del título, o el primero si no hay. Devolver `artworkUrl100` → `coverArt600`.
- Agregar constante `ITUNES_ENTITY_ALBUM = 'album'` y `COVER_FALLBACK_ALBUM = true`.
- Mantener timeout 12s + 1 retry solo transitorio (C-16 intacto).

### `js/app.js`

- Nueva función `resolveCoverLocal(song)` (síncrona, no red): construye los 3 candidatos de ruta (`assets/covers/<artista>-<titulo>.jpg`, `assets/covers/<artista>.jpg`, `assets/covers/<album>.jpg`) y los devuelve como `coverUrl` candidato sin validar existencia de archivo (el `img.onerror` en la pública ya cae a placeholder; no hay forma síncrona de chequear existencia de archivo local en file:// sin fetch). El valor se guarda y la pública lo intenta; si 404, placeholder.
- Nueva función `coverCache` (IndexedDB wrapper):
  - `get(key)` → devuelve `coverUrl` cacheado o `null`.
  - `set(key, url, source)` → almacena URL + fuente (`itunes-simple` / `itunes-album`).
  - Key normalizado: `artist - title` (misma normalización que `dedupe`).
- `enrichAfterImport`: orden de consulta por canción sin `coverUrl`:
  1. `coverCache.get(key)` → si hay, usar y salir.
  2. `resolveCoverLocal(song)` → si hay ruta candidata, usar y salir.
  3. Si `fn` (fetch) disponible: intento 1 iTunes (artista+título) → si match, `coverCache.set` y usar.
  4. Intento 2 iTunes (artista → álbum) → si match, `coverCache.set` y usar.
  5. `coverUrl = null` → placeholder C-14.
- `handleCoverRequest`: mantener actual (ya acepta `assets/covers/<nombre>`). Documentar convención.

### `js/public.js`

- Sin cambios funcionales: `coverFor` ya prefiere `coverUrl` y cae a placeholder. `paintCover` con `img.onerror` → placeholder. El diseño actual satisface R3.

### Tests

- `tests/song-covers.test.js`: ampliar con S1–S11 (mock de fetch para online, `fetchFn = null` para offline, tripwire anti-fetch en show paths, prueba de caché IndexedDB hit/miss).
- `tests/public-cover.test.js`: verificar placeholder cuando `coverUrl` apunta a ruta local inexistente (simulado).

## Seams inyectables

- `fetchFn` inyectado en `resolveCoverURL` / `enrichCovers` (ya existe en C-16). Offline = `null`.
- `coverCache` inyectable para tests (mock de IndexedDB o objeto en memoria).
- `resolveCoverLocal` separada para poder testearla sin filesystem real (los nombres de ruta se construyen como strings; la carga real la hace el navegador vía `.src`).

## Limitación técnica documentada (file://)

En `file://` directo el navegador **no puede escribir archivos físicos** en `assets/covers/` desde JS puro (no hay File System Access API en origen `file://`). Por tanto:
- `assets/covers/` es de **solo lectura** para la app: el operador coloca archivos manualmente si quiere carátulas offline preparadas.
- La caché de escritura automática es **IndexedDB** del navegador (persiste entre recargas en el mismo origen/protocolo).

## Invariables (no romper)

- CERO `fetch(` en `buildStateMessage`, `broadcast`, `render`, `schedulePublicReveal`, `draw.js`, `public.js` (verificado por tests C-16 5.1).
- `REVEAL_DELAY_MS = 5000` intacto (C-15).
- `schemaVersion` sigue 2.
- CSV de historial sigue 6 columnas (C-10).
- `locked` bloquea import y campo manual (C-11/C-16).

---
