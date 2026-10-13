# Music Bingo DJ — Olmos Nahuel

Aplicación web local para gestionar un Bingo Musical con una pantalla de operador y otra pantalla pública. La versión inicial proviene de un prototipo HTML/CSS/JavaScript y debe auditarse antes de usarla en un evento real.

## Requisitos
- Navegador actualizado (Chrome o Edge).
- No requiere Node.js para abrir el prototipo actual: abrir `index.html`.
- Algunas funciones de importación de PDF/DOCX pueden depender de bibliotecas externas y conexión a internet; verificar el comportamiento real del prototipo.

## Primer arranque
1. Abrir la carpeta del proyecto en VS Code.
2. Revisar `AGENTS.md` y `docs/PRODUCT_BRIEF.md`.
3. Iniciar OpenCode desde la raíz del proyecto.
4. Pedir al agente que audite el prototipo antes de cambiarlo.

## Flujo de trabajo del usuario
El proyecto se desarrolla con OpenCode y el harness `active-stack` (SDD), junto con OpenSpec. Consultá `docs/WORKFLOW.md` para el orden establecido: `openspec-init` + `/active-orchestrator`; discovery opcional; `kb-creator`; `roadmap-generator`; Skills/reglas mediante `find-skill`, `skill-registry` y `agent-instruction`; y finalmente el ciclo OPSX del change: `explore → propose → apply → verify → archive`.

El usuario llama SDD a un proceso de 7 pasos, pero la descripción compartida no enumera siete comandos independientes. No inventes los pasos faltantes: recuperá la secuencia formal desde las instrucciones locales de `active-stack`. No implementes funcionalidades fuera del change aprobado y no declares una verificación exitosa sin evidencia real.

## Alcance funcional esperado
- Importar listado de canciones desde PDF/documento o texto estructurado.
- Sorteo uniforme de canciones disponibles, sin repetir una canción ya sorteada.
- Determinar el resultado antes de iniciar la animación; la ruleta solo representa visualmente el resultado.
- Pantalla de operador separada de pantalla pública.
- Revelar título y artista después de la ruleta.
- Historial, exportación y manejo explícito de incidencias.
- La reproducción en VirtualDJ permanece manual en la primera versión.
