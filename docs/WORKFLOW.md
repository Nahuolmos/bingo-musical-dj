# Flujo de trabajo del proyecto: active-stack + OpenSpec + OPSX

Este proyecto debe trabajarse con el entorno del usuario en OpenCode: el harness `active-stack`, que implementa su metodología SDD, y OpenSpec para gestionar los changes.

## A. Preparación SDD (antes de trabajar en un change)

Ejecutar en el orden indicado, respetando las instrucciones reales de las Skills/comandos instalados:

1. **Inicializar el framework** con `openspec-init` y activar `/active-orchestrator`.
2. **Discovery (opcional):** investigar el mercado y las necesidades del producto cuando aporte valor. Si se omite, registrar brevemente por qué no es necesario para el alcance actual.
3. **Crear la base de conocimiento** con `kb-creator`.
4. **Generar el roadmap** con `roadmap-generator`.
5. **Preparar Skills y reglas del agente**, usando `find-skill`, `skill-registry` y `agent-instruction` según corresponda al entorno instalado.
6. **Iniciar el ciclo OPSX para un change** de OpenSpec.

El usuario describe su proceso como SDD de 7 pasos. Los elementos disponibles en esta descripción no enumeran explícitamente siete comandos separados; no inventar un séptimo paso ni subdividir fases arbitrariamente. Consultar las instrucciones del harness `active-stack` si hace falta recuperar la lista formal de siete pasos y mantenerla como fuente de verdad.

## B. Ciclo OPSX por change

Aplicar los cinco pasos en este orden:

1. `explore` — explorar el problema, el contexto y las alternativas; identificar incógnitas.
2. `propose` — formular la propuesta del change, alcance, requisitos, diseño y criterios de aceptación según las convenciones de OpenSpec del proyecto.
3. `apply` — implementar únicamente el cambio aprobado y mantener alineados código y artefactos.
4. `verify` — ejecutar las comprobaciones y pruebas pertinentes; registrar evidencia real, resultados, limitaciones y tareas pendientes.
5. `archive` — archivar el change solo después de la verificación exigida por el flujo local; no declarar completado aquello que no se verificó.

Los nombres y la sintaxis exacta de los comandos OPSX deben confirmarse con las Skills y herramientas instaladas en el entorno. Los nombres anteriores son las etapas proporcionadas por el usuario, no una afirmación sobre la sintaxis exacta del CLI.

## Reglas por change

- Relacionar cada change con el problema de producto y criterios de aceptación verificables.
- No comenzar a editar código antes de completar `explore` y `propose` según el flujo local.
- Respetar las instrucciones de `/active-orchestrator` y del harness `active-stack`; no duplicarlas ni reemplazarlas con una metodología genérica.
- Mantener los documentos de conocimiento y el roadmap coherentes con decisiones aprobadas.
- Si faltan Skills, comandos o documentos, inspeccionar el entorno y reportar el bloqueo concreto; no afirmar que se ejecutó una etapa.
- No afirmar que pruebas pasaron sin haberlas ejecutado. En `verify`, separar pruebas ejecutadas, pruebas no disponibles y revisión manual pendiente.
- Archivar solo según las condiciones del flujo local de OpenSpec/OPSX.

## Change sugerido para comenzar

`audit-initial-prototype`: inspeccionar el prototipo existente, compararlo con el brief y los criterios de aceptación, detectar riesgos operativos y proponer un backlog priorizado. La primera auditoría debe ser de solo lectura; no modificar código hasta que la propuesta sea revisada y aprobada.
