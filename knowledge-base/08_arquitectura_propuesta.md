# Arquitectura Propuesta

## Patrones aplicados

| Patrón | Dónde se usa | Por qué |
|--------|--------------|---------|
| Single-file app (sin build) | Todo en `index.html` (CSS + HTML + JS embebidos) | Portabilidad máxima a 2 días del evento: copiar, doble clic, sin Node/toolchain |
| Commit-before-render (resultado antes de animación) | `draw`/handler `secureIndex`: commit en `songs`/`history` → animación CSS + `setTimeout` | Garantiza RN-SOR-02; la animación nunca decide |
| Estado en memoria + broadcast por evento | `render()` emite snapshot por `BroadcastChannel` en cada cambio | Suficiente para 1 operador + 1 pública; simplicidad > durabilidad en v1 |
| Snapshot en historial | `HistoryEntry` guarda copia de título/artista al sortear | Evidencia estable aunque la lista cambie después |
| Mejora progresiva en importación | TXT/CSV/pegar/demo offline siempre; PDF/DOCX vía CDN bajo demanda | Ruta principal offline (RN-X-01), formatos ricos opcionales |
| Dedupe normalizado | `dedupe()` (lowercase + NFD + espacios) intra y contra lista | Evita repetidos por variantes de escritura |
| Escape de output | `esc()` en lista, historial y pública | Mitiga XSS desde listas no confiables |
| Salvaguardas destructivas | `confirm()` simple/doble en vaciar/reiniciar/anular | Freno mínimo contra borrados en vivo |

## Estructura de directorios

Real (v1, single-file):

```
music-bingo-dj-opencode/
├── index.html                  # app completa (operador + pública generada)
├── README.md / AGENTS.md
├── docs/                       # fuentes (PRODUCT_BRIEF, ACCEPTANCE_CRITERIA, DECISIONS, WORKFLOW)
├── discovery/                  # discovery.md + sources/*.md (competidores)
├── knowledge-base/             # esta KB (10 canónicos + README)
├── openspec/ / .opencode/      # harness active-stack + OpenSpec
└── .active-orchestrator-state.json
```

Propuesta (cambios mínimos, sin framework salvo que el roadmap lo apruebe):

```
├── index.html                  # se mantiene como entrypoint portable
├── styles.css / app.js         # (opcional post-evento) extraer sin cambiar conducta
├── tests/                      # pruebas RN-SOR/RN-IMP/recuperación (ver 10_preguntas_abiertas)
│   └── sorteo.test.js ...
└── assets/                     # logo local, lista ejemplo anonimizada
```

Restricción: no introducir bundler, backend ni DB en v1-dos-días; cualquier extracción debe seguir abriendo por doble clic.

## Seguridad

- Autenticación: ninguna (app local de un operador; el control de acceso es físico).
- Autorización: por superficie (operador todo / pública solo lectura); sin roles configurables.
- Validación de input: `normalizeLine`/`parseText` (líneas vacías, encabezados, URLs), `dedupe`, `accept` del input, `try/catch` en lectura de archivos y clipboard (fallback a `prompt`).
- XSS: `esc()` en todo HTML interpolado con datos de la lista, incluido el `document.write` de la pública.
- Ventanas emergentes: popup same-origin generado localmente; sin datos remotos salvo scripts CDN.
- Privacidad: ningún dato sale del equipo salvo las descargas de `cdnjs` (pdf.js/mammoth); historial solo en memoria + CSV local.
- Pendiente P0: persistencia local cifrada/no (decidir `localStorage` vs IndexedDB), sanitización de CSV (prefijos `=+-@`), y `noopener` del popup — ver `10_preguntas_abiertas.md`.

## Variables de entorno

Ninguna. La app no lee `process.env`, ni `.env`, ni query params de configuración.

| Variable | Descripción | Ejemplo | Sensible |
|----------|-------------|---------|----------|
| — | No aplica (100% cliente, sin backend) | — | — |

Constantes operativas hardcodeadas (candidatas a config post-evento): canal `'music-bingo-dj-on'`, duración `2750 ms`, URLs cdnjs pdf.js/mammoth, nombre CSV.

**Fuentes**: `index.html` (código real), `docs/DECISIONS.md` D-004, `README.md`, `AGENTS.md` (Calidad), `discovery/discovery.md` §9–§10.
