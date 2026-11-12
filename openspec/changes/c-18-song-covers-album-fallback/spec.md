# song-covers-album-fallback Specification

Cadena de resolución de carátulas con fallback a carátula de álbum (online y local) y red de seguridad obligatoria (placeholder C-14). Funciona online (primera carga probable) y offline (evento sin red).

## Requisitos

### R1 — Fallback online a carátula de álbum cuando el sencillo no matchea

**WHEN** `resolveCoverURL` consulta iTunes por `artista + título` y no obtiene match usable (ni exacto ni tier relajado de C-16).  
**THEN** lanza una segunda consulta a iTunes por `artista` sola (`entity=album`, `media=music`), elige el álbum más relevante (el más reciente o cuyo `collectionName` contenga palabras del título) y usa su `artworkUrl100` (convertido a 600x600) como `coverUrl` de la canción.

### R2 — Fallback local/offline en `assets/covers/`

**WHEN** no hay red, o ambos intentos online fallaron, o la canción se importa offline.  
**THEN** el sistema intenta resolver localmente, en este orden:
1. `assets/covers/<artista>-<titulo>.jpg` (carátula del sencillo local).
2. `assets/covers/<artista>.jpg` (carátula de álbum del artista local).
3. `assets/covers/<album>.jpg` (carátula por nombre de álbum local, si el operador la proporcionó).

Si alguna existe y carga, se usa como `coverUrl`.

### R3 — Red de seguridad obligatoria: ninguna sin representación visual

**WHEN** ninguna de las fuentes anteriores produce una imagen usable.  
**THEN** `coverUrl` queda `null` y `coverFor(song)` devuelve `kind: 'placeholder'` (color derivado del `id` + inicial del título, cero red, cero assets). Nunca un slot vacío en la pantalla pública. `img.onerror` → placeholder.

### R4 — Todo es pre-show, cero fetch en show

**WHEN** un sorteo se compromete, la pública revela, o cualquier `render()`/`broadcast()` corre.  
**THEN** cero peticiones de red para carátulas. La resolución ocurre solo en importación (`enrichAfterImport`) y en el campo manual por fila (`handleCoverRequest`), ambos bloqueados cuando `locked === true`.

### R5 — Lock gate y XSS-safe

**WHEN** la sesión está bloqueada (`locked === true`).  
**THEN** importación y campo manual de carátula quedan bloqueados (misma `BLOCKED_MESSAGE` de C-16), sin fetch, sin mutación.

**WHEN** el valor manual contiene `javascript:`, `data:`, markup, rutas con `/` o `..`.  
**THEN** se rechaza (`normalizeCoverValue` devuelve `ok: false`), sin mutar `coverUrl`.

### R6 — Persistencia sin bump de schema

**WHEN** una canción obtiene `coverUrl` por cualquiera de las vías.  
**THEN** el valor viaja en `mbdj.v1` (schemaVersion 2) junto al resto de la canción. Migración v1 → `null` intacta (C-16).

### R7 — Caché persistente de carátulas resueltas online (IndexedDB)

**WHEN** una carátula se resuelve correctamente vía iTunes (sencillo o álbum).  
**THEN** se almacena en IndexedDB del navegador, keyeada por `artist - title` (normalizado), junto con la URL resuelta y la fuente (`itunes-simple` o `itunes-album`).

**WHEN** la misma canción (mismo `artist - title`) se importa nuevamente y ya tiene entrada en IndexedDB.  
**THEN** se usa el valor cacheado directamente, sin llamar a iTunes, ahorrando red y tiempo.

**Nota de implementación:** en `file://` directo el navegador no puede escribir archivos físicos en `assets/covers/` desde JS puro. Por eso `assets/covers/` sigue siendo de **solo lectura** para la app (el operador coloca archivos manualmente si quiere offline), mientras que IndexedDB es la caché de escritura automática que cumple el objetivo de "no volver a buscar online lo que ya se resolvió".

## Escenarios de aceptación

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| S1 | iTunes sencillo exacto matchea | `coverUrl` = artwork del sencillo (600x600). |
| S2 | iTunes sencillo no matchea, álbum del artista sí | `coverUrl` = artwork del álbum (fallback online). |
| S3 | Sin red, `assets/covers/<artista>-<titulo>.jpg` existe | `coverUrl` = ruta local (fallback offline sencillo). |
| S4 | Sin red, solo `assets/covers/<artista>.jpg` existe | `coverUrl` = ruta local del artista (fallback offline álbum). |
| S5 | Sin red, nada local, `coverUrl: null` | Pantalla pública renderiza placeholder C-14 (color + inicial), nunca vacío. |
| S6 | Sorteo/reveal/render con carátulas resueltas | Cero peticiones de red (tripwire anti-fetch en tests). |
| S7 | Sesión `locked`, importación con canciones nuevas | Bloqueado, `BLOCKED_MESSAGE`, cero fetch. |
| S8 | Valor manual `javascript:alert(1)` | Rechazado, `coverUrl` no muta. |
| S9 | Import offline con 12 canciones demo | Todas importan; las que no resuelven online quedan con `coverUrl: null` + placeholder. |
| S10 | Canción importada dos veces con red | Segunda importación usa caché IndexedDB, cero llamada a iTunes. |
| S11 | Canción resuelta online, luego importada sin red | Se usa la carátula cacheada en IndexedDB. |
| S7 | Sesión `locked`, importación con canciones nuevas | Bloqueado, `BLOCKED_MESSAGE`, cero fetch. |
| S8 | Valor manual `javascript:alert(1)` | Rechazado, `coverUrl` no muta. |
| S9 | Import offline con 12 canciones demo | Todas importan; las que no resuelven online quedan con `coverUrl: null` + placeholder. |

## No requisitos (fuera de alcance)

- Fetch en tiempo de show.
- Integración automática con VirtualDJ.
- Descarga automática de imágenes desde la red a `assets/covers/` (el operador las coloca manualmente si quiere offline).
- Cambio de `schemaVersion` (se conserva 2).

---
