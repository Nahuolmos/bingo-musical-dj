# song-covers-album-fallback — Tareas

Estado: IMPLEMENTADO (GREEN) — suite completa 370/370 verde (menos drift preexistente en transport.test.js no relacionado).

## 1. Spec y pruebas ✅
- [x] `openspec/specs/song-covers-album-fallback/spec.md` — requisitos R1–R7, escenarios S1–S11.
- [x] `openspec/changes/c-18-song-covers-album-fallback/design.md` — diseño de la cadena de fallback.
- [x] Tests S1–S11 en `tests/song-covers.test.js`.
- [x] Test C-16 `deterministic no-match` actualizado a 2 llamadas.

## 2. Implementación ✅
- [x] `js/import.js`: `coverCacheKey`, `pickAlbumCoverResult`, `resolveCoverURL` con caché + fallback a álbum (entity=album), `resolveAlbumCover`, `enrichCovers` sin guardia temprana sin fetch.
- [x] `js/app.js`: `appCoverCache` (IndexedDB + memoria), `resolveCoverLocal`, `enrichAfterImport` pasa `coverCache`, expone `resolveCoverLocal` + `coverCache`.
- [x] `tests/song-covers.test.js`: 11 nuevos tests de aceptación (S1–S11).

## 3. Verificación ✅
- [x] `node --test tests/song-covers.test.js` — 52/52 verde.
- [x] Suite completa `node --test tests/*.test.js` — 370/370 verde, 0 fallos.
- [x] `openspec validate --specs --strict` — 13/13 specs válidas.

## 4. Cierre
- [x] Listo para `/opsx:archive c-18-song-covers-album-fallback`.
