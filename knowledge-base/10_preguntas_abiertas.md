# Preguntas Abiertas

> Regla Mode A: lo ambiguo se registra aquí, no se inventa. Ningún campo `discovery` quedó en baja confianza (los 6 se infirieron con confianza razonable desde discovery + docs + código).

## Inconsistencias detectadas

### IN-01 — Bloqueo de lista: brief vs. prototipo
**Documento A dice**: `PRODUCT_BRIEF` §Flujo: "Se inicia una partida y se bloquea la lista usada para esa partida, salvo una acción administrativa registrada." + `discovery` RN "Lista bloqueada una vez iniciada (propuesto)".
**Documento B dice**: `index.html` permite "Vaciar lista" y "Reiniciar partida" en cualquier momento (incluso mid-giro) solo con `confirm()`, sin concepto de partida iniciada ni acción administrativa.
**Impacto**: cambios de lista a mitad del show rompen la justicia auditable.
**Resolución propuesta**: decidir si el bloqueo entra en v1-dos-días o post-evento (pregunta abierta de discovery); mientras tanto, disciplina operativa + export previo.

### IN-02 — Motivo de anulación: exigido pero no persistido
**Documento A dice**: brief + AGENTS + criterios: "anulación exige motivo", "con motivo cuando corresponda", historial con "hora/estado/motivo".
**Documento B dice**: `index.html` (`skipResult`) solo pide `confirm()` genérico; `HistoryEntry` no tiene campo `motivo`.
**Impacto**: la evidencia post-evento no registra el porqué; incumple RN-HIS-02/RN-HIS-03.
**Resolución propuesta**: agregar `prompt()` de motivo obligatorio persistido en entrada + CSV (change menor, apto para v1-dos-días).

### IN-03 — Spoiler pública 2.75 s
**Documento A dice**: criterios: "Antes de revelar presenta animación" + "sin resultados contradictorios".
**Documento B dice**: `draw` hace `broadcast()` con el título **inmediato** al comprometer; el `setTimeout(2750)` solo retrasa el reveal del operador.
**Impacto**: el proyector revela ~2.75 s antes que el panel; el público ve el resultado durante el "giro".
**Resolución propuesta**: emitir estado `spinning` sin título y retrasar el broadcast del resultado hasta el reveal (manteniendo el commit previo).

### IN-04 — Doble sorteo + timeout huérfano
**Documento A dice**: un solo algoritmo uniforme verificable.
**Documento B dice**: `index.html` contiene `draw()` original (`crypto % pool.length`, sesgo de módulo) + handler re-enlazado con `secureIndex()` (rejection sampling); el `setTimeout` de reveal no se cancela ante vaciado/reinicio.
**Impacto**: código muerto confuso; sesgo teórico si revive el handler viejo; reveal fantasma tras borrar.
**Resolución propuesta**: eliminar `draw()` original, conservar solo `secureIndex`, guardar el timeout y cancelarlo en vaciar/reiniciar; pruebas de uniformidad y de cancelación.

### IN-05 — Excel .xlsx: exigido pero no aceptado
**Documento A dice**: `discovery` §5: "Importar Excel/CSV (.xlsx/.csv)".
**Documento B dice**: `fileInput accept=".pdf,.docx,.txt,.csv,.tsv"` (sin `.xlsx`); `README` tampoco lo lista.
**Impacto**: si la lista llega como `.xlsx`, la carga directa falla.
**Resolución propuesta**: confirmar formato real; o agregar SheetJS vendorizado offline, o documentar "exportar a CSV / pegar" como procedimiento oficial.

### IN-06 — Refresh borra todo vs. principio de resiliencia
**Documento A dice**: brief "Resiliencia: recuperación ante recarga/cierre"; criterios "Un refresco no pierde silenciosamente la partida".
**Documento B dice**: estado solo en memoria, sin `localStorage`/IndexedDB; `render()` inicial parte de cero.
**Impacto**: P0 operativo — un F5 a mitad de show pierde lista + historial.
**Resolución propuesta**: autosave a `localStorage` (o IndexedDB) + restauración con aviso, o al mínimo banner permanente "Sin guardado — no recargues; exportá el historial".

### IN-07 — PDF/DOCX offline sin contingencia probada
**Documento A dice**: RN-X-01 + D-004: ruta principal offline o contingencia probada.
**Documento B dice**: `loadScript` a cdnjs sin vendor local ni prueba documentada del fallback en el equipo del evento.
**Impacto**: sin internet, PDF/DOCX fallan en vivo.
**Resolución propuesta**: probar hoy el flujo sin red (demo + pegar texto + CSV) y/o vendor local de pdf.js/mammoth.

## Preguntas abiertas (priorizadas)

| Prioridad | Pregunta | Bloquea | Decisor |
|-----------|----------|---------|---------|
| Alta | ¿El bloqueo de lista entra en v1-dos-días o post-evento? | Diseño de partida + IN-01 | Dueño / DJ |
| Alta | ¿Columnas exactas del Excel real (encabezados, separador `,`/`;`/tab, encoding, extensión `.xlsx` o `.csv`)? | Importación + IN-05 | Dueño / proveedor lista |
| Alta | ¿Se prueba el show sin internet (demo + pegar + CSV + pública + export) en el equipo del evento? | Contingencia offline + IN-07 | DJ |
| Alta | ¿Motivo de anulación en texto libre persistido en historial + CSV? | Evidencia + IN-02 | Dueño |
| Media | ¿Pública con anti-spoiler (estado girando sin título hasta el reveal)? | Diseño pública + IN-03 | Dueño |
| Media | ¿Persistencia local (`localStorage`/IndexedDB) con restauración + aviso? | Resiliencia + IN-06 | DJ + roadmap |
| Media | ¿Limpiar código duplicado de sorteo + cancelar timeout (solo `secureIndex`)? | Calidad + IN-04 | Equipo técnico |
| Baja | ¿Formato exacto de la integración futura VirtualDJ (mostrar vs. disparar)? | Roadmap post-evento | Dueño |
| Baja | ¿Cartones propios / estadísticas / theming entran algún día o se descartan? | Backlog | Dueño |
| Baja | ¿Secuencia formal de 7 pasos SDD desde `active-stack` (no inventar el séptimo)? | Proceso | Orquestador |

**Fuentes**: `discovery/discovery.md` §11, state `discovery.preguntas_abiertas`, `docs/ACCEPTANCE_CRITERIA.md`, `index.html` (brechas observadas, no supuestas).
