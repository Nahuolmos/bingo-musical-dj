# Change Proposal — c-18-song-covers-album-fallback

**Estado:** propuesto  
**Número tentativo:** C-18 (siguiente tras C-17, que sigue pendiente en `openspec/changes/c-17-dj-gated-reveal/`)  
**Autor:** agente (a pedido del operador)  
**Fecha:** 2026-11-11

## Problema

C-16 (`song-covers`) resuelve carátulas pre-show vía iTunes Search API por artista+título, con fallback manual (`assets/covers/` o URL remota) y placeholder generativo C-14 como red de seguridad. Sin embargo:

1. **Sencillo no encontrado en iTunes → carátula vacía.** Repertorio regional/tropical, ediciones locales, versiones en vivo o remixes no matchean el título exacto, ni siquiera con el tier relajado de C-16.
2. **Primera carga de lista probablemente online.** Cuando el operador importa el listado oficial por primera vez (pre-show) lo más probable es que tenga conexión estable, pero el código actual no aprovecha esa conexión para subir un segundo nivel de búsqueda (por ejemplo, por artista solo → álbum).
3. **Sin conexión, cero cobertura automática.** Si no hay red (o el evento es offline-first), todas las canciones quedan con `coverUrl: null` salvo las que el DJ complete manualmente.

El operador quiere: **ninguna canción sin representación visual**, aprovechando la conexión estable de la primera carga cuando exista, y funcionando sin red cuando no la haya.

## Alcance propuesto

Extender la resolución de carátulas de C-16 con una **cadena de fallback ordenada** que funcione tanto online como offline:

1. **Online:** iTunes por `artista + título` (C-16, ya existe).
2. **Online:** iTunes por `artista` solo → carátula del **álbum** más relevante del artista (nuevo: carátula de álbum como fallback del sencillo).
3. **Local/offline:** `assets/covers/<artista>-<titulo>.jpg` (sencillo local).
4. **Local/offline:** `assets/covers/<artista>.jpg` o `assets/covers/<album>.jpg` (carátula de álbum local).
5. **Red de seguridad obligatoria:** placeholder determinista C-14 (color + inicial, cero red, cero assets) si nada de lo anterior aplica.

**No entra en este change:**
- Fetch en sorteo/reveal/render/broadcast (sigue siendo cero).
- Integración automática con VirtualDJ (sigue siendo manual, DD-01).
- Cambio de `schemaVersion` (se agrega `coverAlbumUrl` como campo auxiliar opcional sin romper v2, o se reusa `coverUrl` con metadato interno).

## Reglas duras del proyecto que se respetan

| Regla | Cómo se cumple |
|-------|----------------|
| NUNCA single-file | Cambios solo en `js/import.js`, `js/app.js`, `js/public.js` (ya multifile) + tests. |
| NUNCA `type="module"` desnudo | Scripts clásicos, sin bundler. |
| NUNCA CDN ruta principal | iTunes es llamada bajo demanda solo en import (pre-show), ya permitido por C-16; nada nuevo en la ruta principal. |
| Cero fetch en show | Resolución solo en `enrichAfterImport` / `handleCoverRequest` (pre-show). `draw.js`, `public.js`, `broadcast`, `render` sin fetch. |
| `locked` gatea todo | Import bloqueado si `locked`; campo manual bloqueado si `locked`. |
| XSS-safe | `normalizeCoverValue` ya valida `http(s)` o nombre de archivo sin `/`, `..`, esquemas peligrosos. |
| Placeholder como último recurso | `coverFor()` devuelve `kind: 'placeholder'` cuando no hay imagen usable. |
| CSV historial 6 columnas intacto | Las carátulas son atributo de catálogo (`mbdj.v1`), no van al CSV de C-10. |

## Dependencias

- C-16 `song-covers` (completado, archivado): `coverUrl`, `schemaVersion: 2`, `coverFor`, `enrichCovers`, `resolveCoverURL`.
- C-04 / C-05 (importación): se extiende `enrichAfterImport` con la nueva cadena de fallback.
- C-06 (persistencia): `coverUrl` y eventual `coverAlbumUrl` viajan en `mbdj.v1` sin bump de schema.

## Salidas esperadas

- `js/import.js`: `resolveCoverURL` extensa con segundo intento por artista (álbum) cuando el primero no matchea.
- `js/app.js`: `enrichAfterImport` / nuevo `resolveCoverLocal` que intente `assets/covers/<artista>-<titulo>`, `assets/covers/<artista>`, `assets/covers/<album>` cuando no hay red o falló online.
- `tests/song-covers.test.js`: tests de la cadena de fallback (online álbum, offline local, placeholder siempre).
- `docs/PRE_SHOW_CHECKLIST.md`: ítem para preparar `assets/covers/` con convención de nombres.
- `openspec/specs/song-covers-album-fallback/spec.md` (nueva).
- Archivo `.gitkeep` o ejemplo en `assets/covers/` (documentar convención).

## ¿Por qué no solo offline (Alternativa C sola)?

Porque el operador indica que la primera carga probablemente tiene conexión estable. Aprovechar esa conexión para subir automáticamente carátulas de álbum (fallback 2) reduce la carga manual del DJ. El offline (fallback 3-4) cubre el evento sin red y las canciones regionales que iTunes no tiene.

---
