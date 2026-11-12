# Evidencia drill offline C-16 — tarea 5.2 (ejecutado, archivado como evidencia)

Change: `c-16-song-covers` · Fecha: 2026-10-15 · Entorno: Node v24.16.0, Windows,
red deshabilitada por tripwire (`global.fetch` revienta si algo la toca;
los handlers no reciben `fetchFn`, igual que el panel sin red).

Comando: `node "C:\Users\Lenovo\AppData\Local\Temp\opencode\c16-offline-drill.js"`
(script temporal; los contratos que cubre viven en `tests/song-covers.test.js`).

## Transcript

```text
DRILL 1 demo offline OK: 12 canciones, 0 tapas, nota visible
DRILL 2 paste offline OK: 1 nueva + duplicado contado
DRILL 3 campo manual OK: local assets/covers/, javascript: rechazado
DRILL 4 coverFor OK: image local + placeholder coverless
DRILL 5 sorteo OK: locked=true, spinning scrub, reveal lleva tapa
DRILL 6 confirm/void OK: played + void con motivo persistido
DRILL 7 refresh OK: v2 round-trip, tapa sobrevive, banner recuperada
DRILL 8 export OK: 6 cols + BOM, sin columna de tapas
DRILL 9 lock OK: paste/demo/file bloqueados, 0 fetch
DRILL RESULT: PASS 9/9 (offline, cero fetch, placeholders + 1 local)
```

## Qué verifica cada paso (mapeo al checklist 11c)

1. Importar demo sin red → catálogo usable + `Tapas omitidas (sin conexión)`.
2. Pegar sin red → conteo `N nueva(s), M duplicado(s)` intacto.
3. Campo `Tapa`: `matador.jpg` → `assets/covers/matador.jpg`; `javascript:` rechazado.
4. `coverFor`: local → `image`; sin tapa → placeholder C-14 (mismo hue/inicial).
5. Sorteo → `locked=true`; `spinning` sin título ni tapa; `reveal` con tapa.
6. `played` + `void` con motivo (`Archivo dañado`) en historial.
7. Refresh: `mbdj.v1` v2 round-trip, tapa local sobrevive, banner `Partida recuperada…`.
8. CSV 6 columnas + BOM, sin columna de tapas (viajan en `mbdj.v1`).
9. Bloqueado: paste/demo/file → `BLOCKED_MESSAGE`, cero fetch.

## Checks automáticos verdes (no sustituyen el smoke `file://` pre-show)

- `node --test tests/*.test.js` → 326/326 (baseline pre-fix 318/318).
- Run real con red (probe temporal): `enrichCovers` sobre las 12 demo
  contra iTunes → 12/12 resueltas; tier relajado corrige Shakira/Queen/ABBA
  (antes dependían del orden del fallback).
- `assets/covers/.gitkeep` presente (locales siempre offline).
- Cero fetch en show: test `5.1` (`draw.js`/`public.js` sin `fetch`,
  fns de show sin `fetch(`) + DevTools pendiente del operador pre-show.
