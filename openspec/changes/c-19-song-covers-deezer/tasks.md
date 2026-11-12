# song-covers-deezer — Tareas

Estado: IMPLEMENTADO (GREEN) — suite completa 370/370 verde (menos drift preexistente en transport.test.js no relacionado).

## 1. Spec ✅
- [x] `openspec/changes/c-19-song-covers-deezer/spec.md` — requisitos R1–R7, escenarios S12–S19 (incluye proxy CORS S19).

## 2. Implementación ✅
- [x] `js/import.js`: `DEEZER_SEARCH_URL`, `DEEZER_LIMIT`, `pickDeezerResult`, `singleDeezerAttempt`, `resolveCoverURL` encadenado (Deezer → iTunes simple → iTunes álbum), export de nuevas constantes.
- [x] `js/app.js`: `defaultCoverFetch` con proxy CORS fallback (`api.allorigins.win`) para `file://`; expone `CORS_PROXY_URL`.
- [x] `tests/song-covers.test.js`: tests S12–S16 + ajustes de tests C-16/C-18 + allowlist de proxy.
- [x] `server.js` — servidor estático + proxy CORS local para carátulas online desde `http://localhost:8000`.
- [x] `docs/PRE_SHOW_CHECKLIST.md` — ítem 1 agregado (servidor local para carátulas).
- [x] `README.md` — sección "Servidor local (carátulas online)" agregada.

## 3. Verificación ✅
- [x] `node --test tests/song-covers.test.js` — 58/58 verde.
- [x] `openspec validate --specs --strict` — 13/13 specs válidas.
- [x] `node --check server.js` — sintaxis OK.

## 4. Cierre
- [x] Listo para `/opsx:archive c-19-song-covers-deezer`.
