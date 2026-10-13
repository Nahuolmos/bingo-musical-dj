# Descripción General

## Stack tecnológico

Propuesto por kb-creator bajo la restricción portable/offline (sin build, sin servidor, sin instalación):

| Capa | Tecnologías | Versión mínima |
|------|-------------|----------------|
| UI / App | HTML + CSS + Vanilla JS (ES2021) en un solo `index.html`, sin framework ni bundler | Chrome / Edge actualizado |
| Estado | JS en memoria (arrays `songs`, `history`, `current`, flag `spinning`); sin base de datos en v1 | N/A (persistencia `localStorage`/IndexedDB propuesta en roadmap, no implementada) |
| Doble pantalla | `BroadcastChannel('music-bingo-dj-on')` + `window.open` + `document.write` para la vista pública | Navegador con `BroadcastChannel` |
| Aleatoriedad | `crypto.getRandomValues` + rejection sampling (`secureIndex`, parche al final del script) | WebCrypto disponible |
| Importación texto/CSV | `FileReader` / `File.text()` + parseadores propios (`normalizeLine`, `parseText`, `dedupe`) | N/A |
| Importación PDF/DOCX (online-only) | `pdf.js 3.11.174` + `mammoth.browser 1.8.0` cargados por CDN (`cdnjs`) vía `loadScript` | Requiere internet; fallback: pegar texto manual |
| Exportación | CSV con BOM (`\ufeff`), `Blob` + `URL.createObjectURL` | N/A |
| Build / Runtime | Ninguno: abrir `index.html` directo; no requiere Node.js | — |

> No hay backend, no hay package manager, no hay variables de entorno, no hay contenedores.

## Arquitectura general

```
┌──────────────────────────────────────────────────┐
│ index.html (single-file, 100% cliente)           │
│                                                  │
│  PANEL OPERADOR (ventana principal)              │
│  carga → valida → sortea (commit) → anima 2.75s  │
│  → confirma (played) / anula (void) → exporta    │
│        │                                         │
│        │ BroadcastChannel 'music-bingo-dj-on'    │
│        │ mensaje {type:'state', songs, history,  │
│        │          current, total, remaining,     │
│        │          drawn} en cada render()        │
│        ▼                                         │
│  PANTALLA PÚBLICA (popup generado por            │
│  publicHTML() + document.write, solo lectura)    │
│  ruleta → título/artista → últimas 5 + contador  │
└──────────────────────────────────────────────────┘
         Operador reproduce manualmente en VirtualDJ
         (fuera del sistema en v1, D-001)
```

Decisiones de alto nivel y justificación:

- **Single-file sin build**: maximiza portabilidad (copiar un archivo, doble clic) y elimina dependencias de toolchain a 2 días del evento.
- **Estado en memoria + broadcast por evento**: simple y suficiente para un operador y una partida; el costo aceptado es la pérdida ante refresh (riesgo P0 documentado, ver `10_preguntas_abiertas.md`).
- **Commit-before-render**: el resultado se elige y se persiste en `songs`/`history` antes de iniciar la animación CSS (`spin 2.7s` / `setTimeout 2750ms`); la animación solo comunica.
- **PDF/DOCX como mejora progresiva online**: la ruta offline (TXT/CSV/pegar texto/demo) siempre funciona; los formatos ricos degradan a "pegar texto" sin internet.

Realidad observada en el prototipo (no solo documentación): el script contiene **dos implementaciones de sorteo** — `draw()` original con `crypto % pool.length` (sesgo de módulo) más un handler re-enlazado que usa `secureIndex()` con rejection sampling; el comentario del código lo declara explícitamente. La pública revela el resultado por broadcast **inmediato** al elegir (spoiler ~2.75 s, riesgo P0). `accept=".pdf,.docx,.txt,.csv,.tsv"` en el input (sin `.xlsx` aunque discovery habla de Excel). Estado sin `localStorage`/`IndexedDB`.

## Integraciones externas

| Servicio | Propósito | Tipo |
|----------|-----------|------|
| Ninguna obligatoria en v1 | VirtualDJ se opera manualmente; Excel/Sheets entran por archivo o pegado | Manual |
| cdnjs (pdf.js + mammoth) | Lectura de PDF/DOCX | CDN `<script>` bajo demanda (`loadScript`); **requiere internet, sin contingencia probada** |
| VirtualDJ (futuro) | Mostrar/disparar tema sorteado | Sin definir (ver `10_preguntas_abiertas.md`) |
| Google Sheets directo (futuro) | Lectura directa de la lista | Sin definir |

## API REST (si aplica)

No aplica. La aplicación es 100% cliente sin backend ni endpoints. El "contrato" entre ventanas es el mensaje `BroadcastChannel`:

```js
{ type: 'state', songs, history,
  current: { title, artist, status } | null,
  total, remaining, drawn }
```

**Fuentes**: `index.html` (arquitectura real observada), `docs/PRODUCT_BRIEF.md`, `README.md`, `discovery/discovery.md` §8–§10.
