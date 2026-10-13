# Decisiones y Supuestos

## Decisiones documentadas

### DD-01 — Reproducción manual en VirtualDJ
**Decisión**: el sistema sortea y muestra; el DJ busca y reproduce manualmente en VirtualDJ. No se afirma integración automática.
**Contexto**: a 2 días del evento no hay tiempo ni formato validado para integrar VDJ.
**Alternativas consideradas**: disparo/muestra automática en VDJ; plugin de control.
**Justificación**: evita prometer lo no implementado y mantiene el show operable.
**Trade-offs aceptados**: búsqueda manual (latencia entre sorteo y audio); copiar título/artista al portapapeles como ayuda.
**Origen**: `docs/DECISIONS.md` D-001, `docs/PRODUCT_BRIEF.md`, `discovery/discovery.md` §8.

### DD-02 — Sin repetición por partida
**Decisión**: las sorteadas se excluyen de sorteos siguientes; excepciones futuras solo con definición explícita y registro.
**Contexto**: repetidos = discusiones y show roto.
**Alternativas consideradas**: reingreso de anuladas; repechaje; blacklist por tiempo.
**Justificación**: justicia y transparencia auditables.
**Trade-offs aceptados**: error de carga (tema duplicado real) exige corrección de lista, no re-sorteo.
**Origen**: `docs/DECISIONS.md` D-002, RN-SOR-01.

### DD-03 — Resultado independiente de la animación
**Decisión**: el algoritmo determina el resultado antes de animar; la animación lo comunica.
**Contexto**: credibilidad del sorteo en vivo.
**Alternativas consideradas**: elegir por posición final de la ruleta.
**Justificación**: evita manipulación visual y permite verificar el compromiso en código/pruebas.
**Trade-offs aceptados**: spoiler por broadcast inmediato (riesgo P0 a resolver sin romper el commit).
**Origen**: `docs/DECISIONS.md` D-003, RN-SOR-02.

### DD-04 — Operación local primero; CDN bajo auditoría
**Decisión**: priorizar operación local; inspeccionar si PDF/DOCX dependen de CDN y, de ser así, documentar o dar alternativa offline.
**Contexto**: la red del local no es confiable.
**Alternativas consideradas**: empaquetar pdf.js/mammoth en local; pre-convertir listas; solo TXT/CSV.
**Justificación**: la ruta principal no puede depender de internet.
**Trade-offs aceptados**: PDF/DOCX solo con internet hasta decidir empaquetado; fallback "pegar texto" siempre disponible.
**Estado**: pendiente de auditoría en DECISIONS; **confirmado por kb-creator en código**: `loadScript` a cdnjs, sin vendor local.
**Origen**: `docs/DECISIONS.md` D-004, `README.md`, `index.html`.

### DD-05 — Single-file vanilla sin build ni backend
**Decisión**: un solo `index.html` portable (HTML+CSS+JS), sin Node, framework, backend ni DB en v1.
**Contexto**: plazo 2 días, un operador, abrir por doble clic en Chrome/Edge.
**Alternativas consideradas**: Vite/React + backend; app instalable; Google Sheets directo.
**Justificación**: simplicidad, portabilidad y cero toolchain superan a escalabilidad que no se necesita.
**Trade-offs aceptados**: sin persistencia, sin tests automatizados aún, código monolítico (~30 KB), doble implementación de sorteo a unificar.
**Origen**: inferida de `index.html` + `README.md` + restricción "Stack lo propone kb-creator".

### DD-06 — Doble pantalla por BroadcastChannel + popup generado
**Decisión**: pública como popup `document.write(publicHTML())` sincronizado por `BroadcastChannel('music-bingo-dj-on')`.
**Contexto**: separar operación privada y show público con cero infra.
**Alternativas consideradas**: segunda pestaña manual, proyector espejado, servidor websocket.
**Justificación**: cero instalación, sincronización local instantánea.
**Trade-offs aceptados**: requiere permitir popups en archivos locales; spoiler inmediato; sin reconexión formal.
**Origen**: inferida de `index.html` (`openPublic`, `publicHTML`, `broadcast`).

## Supuestos inferidos

### SU-01 — La lista real cabe en los formatos soportados
**Supuesto**: `Artista - Titulo` + CSV/Sheets plano cubre toda la lista del evento sin filas dudosas.
**Origen**: `discovery/discovery.md` §10 (riesgo declarado "supuesto sin probar").
**Riesgo si es falso**: filas mal parseadas en vivo, correcciones bajo presión.
**Cómo validar**: pedir la lista real hoy y pasarla por `parseText`; registrar filas dudosas.

### SU-02 — Excel del evento se entrega convertible
**Supuesto**: el Excel llega como `.xlsx` convertible a CSV o copiable como texto; el input actual no acepta `.xlsx`.
**Origen**: `discovery/discovery.md` §5 vs `accept` en `index.html`.
**Riesgo si es falso**: el DJ no puede cargar el archivo tal cual llega.
**Cómo validar**: preguntar columnas exactas, separador, encoding y extensión real (ver `10_preguntas_abiertas.md`).

### SU-03 — Un operador basta y no hay concurrencia
**Supuesto**: un solo operador, una partida a la vez, sin ediciones concurrentes ni multi-sesión.
**Origen**: `discovery/discovery.md` §2/§9, brief.
**Riesgo si es falso**: condiciones de carrera en `songs`/`history`, broadcasts cruzados.
**Cómo validar**: confirmar con el dueño que no habrá segundo operador ni dos eventos simultáneos.

### SU-04 — Proyector y audio se prueban antes
**Supuesto**: hay tiempo de prueba de proyector, popup, audio y archivos VDJ antes del público.
**Origen**: consejo en `index.html` ("probá el proyector... antes de que llegue el público").
**Riesgo si es falso**: popups bloqueados, texto ilegible o audios faltantes en vivo.
**Cómo validar**: checklist pre-show (ver `06 US-008`, `07 Flujo 4`).

### SU-05 — 12 canciones demo representan el volumen real
**Supuesto**: el evento maneja decenas (no miles) de canciones; búsqueda lineal y broadcast completo bastan.
**Origen**: demo de 12 + ausencia de paginación en código.
**Riesgo si es falso**: lista de cientos con scroll/filtro lentos.
**Cómo validar**: contar filas de la lista real; si > 500, medir `render()` en el equipo del evento.
