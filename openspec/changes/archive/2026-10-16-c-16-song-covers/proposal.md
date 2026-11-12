# Proposal — c-16-song-covers

## Why

La pantalla pública muestra hoy un placeholder generativo por canción (C-14 `coverFor` OPCIÓN A). Para un show con proyector, la tapa real del tema eleva el reconocimiento y el clima de juego. Se resuelve en la importación pre-show (con red), nunca en el reveal, preservando el offline total del show.

## What Changes

- **Auto por internet en la IMPORTACIÓN** (solo pre-show, nunca en reveal/draw): al importar (pegar/file/demo) se intenta resolver tapa por canción vía API sin key y con CORS (`iTunes Search API`); éxito → `Song.coverUrl`; sin red o sin match → `null` + placeholder generativo actual, sin error bloqueante, con informe visible (aceptadas + tapas resueltas/no resueltas).
- **Manual por canción en el listado**: campo por fila en la lista del operador para ver/fijar la tapa (URL remota o nombre de archivo en `assets/covers/`), con fallback al placeholder; editable solo con sesión desbloqueada (respeta `locked` C-07/C-11 igual que editar título/artista).
- **Persistencia**: bump `schemaVersion 1→2` con migración (songs viejas sin `coverUrl` → `null`); autosave/recupero C-06 intactos. `coverFor(song)` usa `coverUrl` con fallback generativo actual (no rompe tests C-14).
- **Export CSV: NO se agrega columna** (decisión documentada): la tapa es atributo del catálogo (`Song`), no evidencia del sorteo (`HistoryEntry`); el CSV de historial sigue `Nº,Título,Artista,Estado,Hora,Motivo` intacto. Las tapas viajan en `mbdj.v1`, no en el CSV.
- **Offline del show intacto**: remotas caen a placeholder sin romper nada; locales `assets/covers/` siempre offline. Ningún fetch en draw/reveal/render/broadcast.

## Capabilities

### New Capabilities

- `song-covers`: resolución de tapas en importación (API sin key + timeout + best-effort), override manual por canción, y contrato de render `coverFor` (remota → local `assets/covers/` → placeholder generativo C-14). Dueña de los requisitos de tapas a futuro.

### Modified Capabilities

- `session-models`: `Song` suma `coverUrl: string|null` (nullable, `''` normalizado a `null`); factories y `Session.schemaVersion` pasan a `2`.
- `import-catalog`: paste/demo resuelven tapa best-effort post-parse (conteo visible, nunca bloqueante, nunca en reveal).
- `import-file`: file (TXT/CSV/TSV/XLSX/PDF/DOCX ya parseados) resuelve tapa con la misma vía best-effort.
- `session-persistence`: bump `schemaVersion 1→2` + migración forward (ausente → `null`); payload `mbdj.v1` lleva `schemaVersion: 2`; `schemaVersion: 1` se migra, no se rechaza como corrupto.
- `public-screen`: `coverFor(song)` prefiere `coverUrl` válida, fallback al placeholder C-14 intacto (mismo `hue`/`initial`); espejo inline `coverForInline` idéntico.
- `session-lock`: fijar tapa por fila exige sesión desbloqueada (mismo `BLOCKED_MESSAGE` + guard-first que editar; sin vía admin dentro del campo).

## Impact

- Código: `js/core.js` (Song + `schemaVersion`), `js/import.js` (enriquecimiento best-effort), `js/app.js` (lista + fileInput + desbloqueo + campo tapa), `js/store.js` (bump + migración), `js/public.js` (`coverFor` + espejo inline + `public.html`), `assets/covers/` (nuevo dir, `.gitkeep`; locales siempre offline).
- Red: solo `https://itunes.apple.com/search` durante importación (fetch pre-show con timeout 12 s por intento + 1 retry transitorio, `limit=8`, secuencial, tolerante a fallo; orden: automático-online → retry → `null` + manual). Sin keys ni secretos en repo. Cero fetch en show (draw/reveal/render/broadcast/public).
- Tests: suite actual 295/295 debe seguir verde (C-14 `coverFor` fallback intacto); nuevos RED en seams (resolución mockeada, migración 1→2, lock del campo, fallback offline).
- Breaking: **`schemaVersion 1→2` (BREAKING de formato, migrado forward)** — snapshots v1 se aceptan y migran; snapshots con versión desconocida/futura siguen corruptos.
- No toca: `REVEAL_DELAY_MS=5000` (C-15 vigente), columnas CSV, orden `drawn/played/void`, `secureIndex`, `BroadcastChannel` + espejo `localStorage`.
