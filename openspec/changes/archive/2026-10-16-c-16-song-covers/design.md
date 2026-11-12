# Design — c-16-song-covers

## Context

See proposal.md (Why). Current state: `Song {id,title,artist,status,addedAt}` (core.js + import.js factories duplicated, not unified); `schemaVersion=1`, key `mbdj.v1` (store.js); `coverFor(song)` + inline `coverForInline` return generative placeholder only (public.js, C-14 seam B reserved `assets/covers/<song-id>.jpg` convention); operator list renders title/artist/pill/Edit per row with lock disables (app.js `render` + `handleEditRequest` + `BLOCKED_MESSAGE`); import paths: paste/demo (`handlePasteImport`/`handleDemoImport` → `guardedImport`) and fileInput (text/xlsx/pdf/docx); `REVEAL_DELAY_MS=5000` owns the only timed window (C-15). Suite 295/295, lista vacía.

## Goals / Non-Goals

**Goals:** covers resolvable pre-show (auto + manual), show 100% offline, C-14 fallback intact, schema migrado sin pérdida.
**Non-Goals:** NO columna CSV; NO cambio de reveal delay (sigue 5000 ms — el task que cita 3000 se documenta como desactualizado); NO fetch en show; NO reingreso de `void`; NO unificación de factories `createSong`/`normalizeLine` (se tocan solo para añadir `coverUrl`); NO theming/cartones.

## Decisions

1. **API: iTunes Search API** (`https://itunes.apple.com/search?term=<artist title>&media=music&entity=song&limit=8`, `artworkUrl100` → `600x600` por reemplazo `100x100`→`600x600`).
   Rationale: sin key ni secreto, CORS `*` (apta para `file://` con red), calidad suficiente para proyector, rate-limit generoso para <1000 canciones secuenciales. `limit=8` (antes 3): pool mayor para los tiers exacto→relajado→primero, útil en repertorio local donde el match exacto cae en posiciones 4-8; payload JSON sigue mínimo.
   Alternatives: MusicBrainz/Cover Art Archive (dos pasos + CORS parcial + thumbs pobres → descartado); Deezer API (CORS ok pero hotlink con expiración → descartado); Spotify (key obligatoria → viola "sin secretos").
2. **Enriquecimiento post-parse, secuencial, best-effort, con timeout 12 s por intento + 1 retry ante fallo transitorio** en `js/import.js` (`enrichCovers(songs, fetchFn, onProgress?, opts?)` inyectable; `fetchFn` real solo desde app.js; `opts {timeoutMs,retries,limit}` override de defaults como seam de test rápido, mismo code path). Pre-show tuning (operador 2026-10-15: la carga+tapas es pre-show, sin apuro de timeout corto; maximizar automático online antes de manual): 12 s cubre p95 de iTunes en redes lentas con margen; peor caso 24 s/canción, aceptable porque es no-bloqueante (progreso i/N vivo, catálogo usable mientras tanto). Retry SOLO ante transitorio (timeout/aborto/rechazo/sin-respuesta/`ok:false`/json-error); respuesta válida sin match → `null` sin reintentar. El retry vive solo en esta vía de importación (locked-gated, cero fetch en show) → por construcción SOLO pre-show. Fallo terminal → `null`, nunca throw hacia `importSongs`. Secuencial evita rate-limit; canciones ya con `coverUrl` (re-import/dedupe) no se re-resuelven.
3. **Campo por fila: `<input data-cover-for="<id>">` + botón Fijar + mini-preview `<img>` con `onerror`→placeholder**, dentro del `.song` row; `handleCoverRequest(songId, rawValue, {fetchHead?})` reutiliza guard-first `isImportBlocked()` + `BLOCKED_MESSAGE`. Normalización: trim; `''`→`null` (limpiar); `http(s)://`→remota tal cual; sin esquema y sin `/` ni `\` ni `..`→`assets/covers/<name>`; resto→rechazo visible (no muta). `esc()` en value/preview como título/artista.
4. **Schema 1→2 con migración forward en `store.load`**: `schemaVersion===1` válido → normaliza songs (`coverUrl ?? null`) y `save` escribe `2`; otro desconocido/futuro → `corrupt` (sin cambios). `KEY` sigue `mbdj.v1` (misma key, nuevo schema). `core.createSession`/`state.schemaVersion` → `2`.
5. **`coverFor` resuelve en este orden: `coverUrl` http(s) → `assets/covers/<coverUrl|song-id>` local (B) → placeholder A intacto** (mismo `hue`/`initial`). Retorno extendido `{kind:'image'|'placeholder', src?, hue, background, initial}`; el inline mirror y `paintCover`/`buildPublicHTML` aplican `<img src>` con `onerror`→placeholder. Tests C-14 existentes (kind placeholder, hue determinista) siguen verdes porque `coverUrl:null` produce idéntico resultado.
6. **Broadcast/render llevan `coverUrl` ya incluida en el objeto song** (cero campo nuevo en el envelope; `buildStateMessage` no cambia de forma). Spinning scrub ya vacía title/artist — también vacía `coverUrl` en el clon `drawn` (anti-spoiler de artwork).

## Risks / Trade-offs

- [iTunes sin match para repertorio local/cumbia] → Mitigación: campo manual + locales `assets/covers/`; informe "X/Y tapas" visible para completar a mano pre-show.
- [Fetch lento pre-show (1000 canciones × latencia)] → Mitigación: secuencial + timeout 12 s + 1 retry transitorio + progreso en `importMessage` ("Resolviendo tapas 12/120…"); el catálogo ya está usable antes de que terminen las tapas (enriquecimiento async post-`importSongs`, cada resolución persiste vía autosave). Orden de fallback explícito: automático-online → retry → `null` + manual (campo por fila / locales `assets/covers/`).
- [`file://` + remote artwork en `public.html`] → Riesgo: proyector sin red muestra placeholder. Mitigación: `onerror` fallback probado offline; recomendación pre-show: precargar locales para temas clave.
- [Migración a medias si recargan durante el enriquecimiento] → Mitigación: `importSongs` persiste primero el catálogo con `null`; cada tapa resuelta es un update idempotente por id.
- [XSS vía URL `javascript:`] → Mitigación: allowlist `https?` + bare filename; todo render por `esc()`.

## Migration Plan

1. Deploy = abrir `index.html` (sin build). 2. Primer boot con `mbdj.v1` v1 → migra en memoria, persiste v2 en el próximo `render()`. 3. Rollback: el código nuevo lee v1 y v2; volver al código anterior con un `mbdj.v1` ya en v2 muestra "Respaldo dañado → vacío" (documentado en pre-show checklist: exportar CSV antes). Sin rollback de datos necesario (covers son re-resolvibles).

## Open Questions

Ninguna bloqueante. Pre-show tuning aplicado (2026-10-15): `limit=8` + pick exacto-insensible + tier relajado, fallback primero; timeout 12 s + 1 retry transitorio.
