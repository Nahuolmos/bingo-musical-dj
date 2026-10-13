# Music Bingo DJ — Base de Conocimiento

Base de conocimiento generada por `kb-creator` en **Mode A (ingest silencioso, sin preguntas)** a partir de `docs/PRODUCT_BRIEF.md`, `docs/ACCEPTANCE_CRITERIA.md`, `docs/DECISIONS.md`, `docs/WORKFLOW.md`, `AGENTS.md`, `README.md`, `index.html` (arquitectura real vanilla single-file) y `discovery/discovery.md` + `discovery/sources/*.md`, con pre-fill de la sección `discovery` de `.active-orchestrator-state.json`. Lo ambiguo se registró en `10_preguntas_abiertas.md` sin inventar.

## Índice de Archivos

| Archivo | Contenido |
|---------|-----------|
| [01_vision_y_objetivos.md](01_vision_y_objetivos.md) | Propósito, objetivos por actor, alcance v1, fuera de alcance, métricas |
| [02_descripcion_general.md](02_descripcion_general.md) | Stack vanilla single-file propuesto, arquitectura dual-view BroadcastChannel, integraciones (CDN online-only), contrato entre ventanas |
| [03_actores_y_roles.md](03_actores_y_roles.md) | DJ único, público, organizador; matriz por superficie; rutas locales |
| [04_modelo_de_datos.md](04_modelo_de_datos.md) | Song, HistoryEntry, Session en memoria; ERD; dedupe; seed demo 12 canciones |
| [05_reglas_de_negocio.md](05_reglas_de_negocio.md) | Reglas RN-SOR/RN-IMP/RN-SES/RN-PUB/RN-HIS/RN-X + brechas conocidas |
| [06_funcionalidades.md](06_funcionalidades.md) | US-001…US-013 por épica (carga, sorteo, doble pantalla, historial, resiliencia) |
| [07_flujos_principales.md](07_flujos_principales.md) | Importar, sortear+animar+reproducir, anular, pública, exportar, vaciar/reiniciar |
| [08_arquitectura_propuesta.md](08_arquitectura_propuesta.md) | Patrones, estructura real + propuesta mínima, seguridad, sin env vars |
| [09_decisiones_y_supuestos.md](09_decisiones_y_supuestos.md) | DD-01…DD-06 + SU-01…SU-05 con origen, riesgo y validación |
| [10_preguntas_abiertas.md](10_preguntas_abiertas.md) | IN-01…IN-07 + preguntas priorizadas (bloqueo lista, Excel real, offline, motivo, spoiler, persistencia) |

Sin archivos extra `1X_`: el dominio no exige complementos (sin pagos, sin infra compleja).

## Quick Start para Desarrolladores

1. Entender el dominio → [01](01_vision_y_objetivos.md), [03](03_actores_y_roles.md)
2. Entender los datos → [04](04_modelo_de_datos.md)
3. Entender las reglas → [05](05_reglas_de_negocio.md)
4. Entender la arquitectura → [02](02_descripcion_general.md), [08](08_arquitectura_propuesta.md)
5. Implementar → [07](07_flujos_principales.md), [06](06_funcionalidades.md)
6. Antes de codificar → [10](10_preguntas_abiertas.md)

## Resumen Ejecutivo

Music Bingo DJ es una app web local portable (un `index.html` vanilla, Chrome/Edge, sin build ni backend) para que un solo DJ sortee canciones uniformemente sin repetición —resultado comprometido antes de la animación— con pantalla pública sincronizada por BroadcastChannel, importación multiformato con fallback offline, ancla manual en VirtualDJ e historial auditable con export CSV; los riesgos P0 a resolver antes del show son refresh sin persistencia, spoiler de la pública (~2.75 s), CDN pdf.js/mammoth sin contingencia probada y formato real de la lista sin validar.
