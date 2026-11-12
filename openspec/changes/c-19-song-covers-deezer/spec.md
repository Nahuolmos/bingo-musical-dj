# song-covers-deezer Specification

Agrega Deezer Search API como fuente primaria de carátulas antes que iTunes, en la cadena de fallback de C-16/C-18. Gratis, keyless, sin pasos manuales.

## Requisitos

### R1 — Deezer como fuente primaria

**WHEN** se importa una canción sin `coverUrl` y hay red disponible.  
**THEN** el sistema consulta Deezer `https://api.deezer.com/search?q=<artist+title>&type=track&limit=10`. Si hay un resultado usable (título y artista coinciden, insensible a mayúsculas/diacríticos), se usa `album.cover_big` (o `cover_medium` si no hay `cover_big`) como `coverUrl`.

### R2 — Fallback encadenado Deezer → iTunes sencillo → iTunes álbum

**WHEN** Deezer no retorna match usable (o falla la red).  
**THEN** el sistema intenta iTunes por `artista + título` (entity=song), y si tampoco matchea, iTunes por `artista` solo (entity=album, fallback de C-18).

### R3 — Caché IndexedDB primero

**WHEN** la canción ya tiene entrada en `coverCache` (IndexedDB).  
**THEN** se usa el valor cacheado sin llamar a Deezer ni a iTunes.

### R4 — Cero fetch en show

**WHEN** sorteo, reveal, render o broadcast.  
**THEN** cero peticiones de red para carátulas.

### R5 — Proxy CORS para file://

**WHEN** la app se ejecuta desde `file://` (origen `null`) y Deezer o iTunes rechazan la petición por CORS.  
**THEN** el sistema reintenta la misma petición vía proxy público gratuito (`https://api.allorigins.win/raw?url=...`) que añade `Access-Control-Allow-Origin`. Esto solo aplica a la importación pre-show, nunca al show.

### R6 — Lock gate y XSS-safe

**WHEN** `locked === true`.  
**THEN** importación bloqueada, cero fetch, `BLOCKED_MESSAGE`.

**WHEN** el valor de `coverUrl` contiene esquema no seguro.  
**THEN** se rechaza (ya cubierto por C-16 `normalizeCoverValue`).

### R7 — Red de seguridad obligatoria

**WHEN** ninguna fuente produce imagen usable.  
**THEN** `coverUrl: null` y `coverFor()` devuelve `kind: 'placeholder'` (C-14). Nunca slot vacío.

## Escenarios de aceptación

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| S12 | Deezer match exacto | `coverUrl` = `album.cover_big` de Deezer. |
| S13 | Deezer nomatch → iTunes simple match | `coverUrl` = artwork de iTunes sencillo (600x600). |
| S14 | Deezer nomatch → iTunes simple nomatch → iTunes álbum match | `coverUrl` = artwork de álbum de iTunes. |
| S15 | Deezer + iTunes simple + iTunes álbum fallan | `coverUrl: null`, placeholder C-14 disponible. |
| S16 | Caché hit en Deezer/iTunes | Cero llamadas a red, se usa caché IndexedDB. |
| S17 | Sorteo/reveal/render con carátulas | Cero `fetch(` en show paths. |
| S18 | Sesión `locked` | Import bloqueado, `BLOCKED_MESSAGE`, cero fetch. |
| S19 | `file://` con CORS bloqueado en Deezer/iTunes | Reintento vía proxy `api.allorigins.win`, carátula resuelta o `null` + placeholder. |

## No requisitos

- Spotify (requiere OAuth2 + token cada hora, descartado por complejidad operativa).
- Descarga automática de imágenes a `assets/covers/` (solo lectura en `file://`).

---
