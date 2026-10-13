# Registro de decisiones

## D-001 — Reproducción manual en VirtualDJ
**Estado:** aceptada para la primera versión.

El sistema sortea y muestra la canción; el DJ la busca y reproduce manualmente en VirtualDJ. No se afirmará que existe integración automática.

## D-002 — Sin repetición por partida
**Estado:** aceptada.

Las canciones ya sorteadas se excluyen de los sorteos siguientes. Cualquier excepción futura debe definirse explícitamente y quedar registrada.

## D-003 — Resultado independiente de la animación
**Estado:** aceptada.

El algoritmo determina el resultado antes de animar la ruleta. La animación comunica el resultado; no lo elige.

## D-004 — Dependencias durante el evento
**Estado:** pendiente de auditoría.

La aplicación debe priorizar operación local. Hay que inspeccionar el prototipo y verificar si los lectores de PDF/DOCX dependen de bibliotecas CDN; si dependen de internet, documentar o implementar una alternativa offline.
