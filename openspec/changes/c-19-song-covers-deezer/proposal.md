# Change Proposal — c-19-song-covers-deezer

**Estado:** propuesto  
**Número tentativo:** C-19 (siguiente tras C-18, que está implementado y listo para archive)  
**Autor:** agente (a pedido del operador)  
**Fecha:** 2026-11-12

## Problema

C-16/C-18 resuelven carátulas únicamente vía iTunes Search API. iTunes tiene cobertura limitada para repertorio regional/tropical/cumbia (Ráfaga, Los Palmeras, Vilma Palma, Los Fabulosos Cadillacs en algunas ediciones, etc.) y un matching muy estricto. Resultado: entre el 90 y 100 % de las canciones quedan con `coverUrl: null` → placeholder C-14.

El operador necesita una alternativa gratuita, sencilla y sin pasos manuales recurrentes (se descarta Spotify por requerir OAuth2 + renovación de token cada hora).

## Solución propuesta

Agregar **Deezer Search API** como fuente primaria en la cadena de fallback de carátulas:

```
1. Caché IndexedDB (artist - título)              → si ya se resolvió antes
   ↓ si no
2. Deezer API: search q="artista título"          → track → album.cover_big  (NUEVO)
   ↓ si no hay match usable
3. iTunes Search API (entity=song)                → artworkUrl100 → 600x600  (C-16)
   ↓ si no matchea
4. iTunes Search API (entity=album)               → artwork del álbum        (C-18)
   ↓ si no hay red o falló online
5. assets/covers/<artista>-<titulo>.jpg           → local (solo lectura)
   ↓ si no existe
6. assets/covers/<artista>.jpg                    → álbum del artista local
   ↓ si no existe
7. assets/covers/<titulo>.jpg                     → título local
   ↓ si no existe
8. coverUrl = null                                → placeholder C-14 (siempre)
```

### ¿Por qué Deezer?

- **Keyless:** no requiere API key ni OAuth2.
- **CORS habilitado:** funciona desde `file://` (origen `null`) en Chrome/Edge.
- **Cobertura latina:** mejor catálogo de tropical/cumbia/reggaeton que iTunes.
- **Sin pasos manuales:** no hay tokens que renovar cada hora (a diferencia de Spotify).
- **Gratis:** tasa de consultas razonable para un catálogo de evento (< 300 canciones).

## Reglas duras del proyecto que se respetan

| Regla | Cómo se cumple |
|-------|----------------|
| NUNCA single-file | Cambios solo en `js/import.js` + tests. |
| NUNCA `type="module"` | Scripts clásicos, sin bundler. |
| NUNCA CDN en ruta principal | Deezer/iTunes se llaman solo en importación pre-show (bajo demanda). |
| Cero fetch en show | `draw.js`, `public.js`, `broadcast`, `render` sin `fetch`. |
| `locked` gatea todo | Import bloqueado si `locked === true` (C-16/C-18 intacto). |
| XSS-safe | Solo se usan URLs `https://` devueltas por Deezer; `coverUrl` viaja escapada. |
| Placeholder como red de seguridad | `coverFor()` devuelve `placeholder` si `coverUrl: null`. |
| CSV historial 6 columnas | Las carátulas son atributo de catálogo (`mbdj.v1`), no van al CSV. |
| `schemaVersion` sin bump | Sigue 2 (C-16/C-18). |

## Dependencias

- C-18 `song-covers-album-fallback` (implementado, no archivado aún): `coverCacheKey`, `resolveCoverURL` con caché, `resolveAlbumCover`, `enrichCovers` con `coverCache`.
- C-16 `song-covers` (archivado): `coverUrl`, `schemaVersion: 2`, `coverFor`, `paintCover` con `onerror` → placeholder.

## Salidas esperadas

- `js/import.js`: `DEEZER_SEARCH_URL`, `DEEZER_LIMIT`, `pickDeezerResult`, `singleDeezerAttempt`, `resolveCoverURL` encadenado (Deezer → iTunes simple → iTunes álbum).
- `tests/song-covers.test.js`: tests S12–S15 (Deezer match, fallback chain, todo falla).
- `openspec/specs/song-covers-deezer/spec.md` (nueva o delta a song-covers).
- Archivo listo para `/opsx:archive c-19-song-covers-deezer`.

---
