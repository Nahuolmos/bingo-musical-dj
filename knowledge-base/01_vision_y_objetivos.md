# Visión y Objetivos

## Propósito del sistema

**Music Bingo DJ es la herramienta local de DJ Olmos Nahuel para gestionar sorteos transparentes de canciones en eventos de Bingo Musical y proyectar una experiencia visual atractiva.**

En vivo, el sorteo manual (papelitos, apps genéricas no pensadas para show) produce repetidos, discusiones y ritmo roto. El sistema reemplaza ese proceso por un sorteo digital uniforme, sin repetición, con doble pantalla (operador privada / público proyector) e historial auditable, operable por una sola persona en el evento.

## Objetivos por actor

| Actor | Objetivo principal | Objetivos secundarios |
|-------|--------------------|----------------------|
| DJ / Operador (único) | Sortear canciones sin repetir y mantener el ritmo del show | Cargar y validar la lista oficial antes del evento; anular con motivo ante incidencias; exportar historial como evidencia |
| Público (participantes con cartón físico) | Seguir el juego en el proyector sin confusión | Ver ruleta + título/artista legibles a distancia; cantar al completar cartón |
| Organizador del evento (stakeholder indirecto) | Tener una sesión auditable sin discusiones | Recibir historial exportado; ser informado de incidencias con motivo |

## Alcance v1 (evento único, 2 días)

- Importar listado oficial desde archivo (PDF, DOCX, TXT, CSV/TSV) o pegado de texto manual como fallback offline.
- Formatos de texto soportados: `Artista - Titulo`, `Titulo — Artista`, solo `Titulo`; texto plano copiado desde Google Sheets y desde CSV; carga demo de 12 canciones.
- Validación visible: informar cuántas canciones se detectaron y cuáles requieren corrección; revisión completa de la lista antes de comenzar; sin descartes silenciosos.
- Sorteo uniforme entre canciones disponibles, sin repetición en la partida; resultado comprometido en estado antes de la animación (la ruleta solo lo representa).
- Casos borde: cero elegibles bloquea el sorteo; una elegible es determinista; lista agotada con mensaje claro y sin resultado ficticio.
- Doble pantalla: panel operador + ventana pública independiente sincronizada por `BroadcastChannel`, con animación de ruleta y revelado de título + artista.
- Historial de sesión con canción, hora/orden y estado posterior; anulación con motivo (confirmación) que excluye la canción; exportación CSV con BOM.
- Reproducción manual en VirtualDJ (el panel no controla VirtualDJ).
- Portable y offline-first en la ruta principal: un solo `index.html`, abrir en Chrome/Edge sin instalar ni build.

## Fuera de alcance

- Selección / reproducción automática en VirtualDJ (D-001: manual en v1; integración futura sin especificar formato).
- Aplicación móvil nativa.
- Sincronización en la nube, múltiples operadores remotos o sesiones concurrentes.
- Verificación automática de cartones de participantes.
- Generación / impresión de cartones propios desde la app (backlog; competidores como Sacodejuegos/Bingo Maker lo hacen, nosotros no en v1).
- Estadísticas del evento, theming por local (backlog, un solo diseño fijo en v1).
- Lectura directa de Google Sheets / API (futuro; en v1 solo archivo o pegado manual).

## Métricas de éxito

- Cero canciones repetidas en la partida salvo regla futura explícita (verificable en historial + pruebas).
- Cero resultados ficticios con lista vacía/agotada.
- 100% de sorteos con entrada correspondiente en historial (canción + hora/orden + estado).
- 100% de anulaciones con motivo registrado/confirmado.
- Ruta principal (cargar demo/pegar texto → sortear → revelar en pública → confirmar → exportar) ejecutable sin internet en Chrome/Edge.
- Operación con controles grandes utilizables en < 2 s por acción principal durante el show.

**Fuentes**: `docs/PRODUCT_BRIEF.md`, `docs/ACCEPTANCE_CRITERIA.md`, `docs/DECISIONS.md`, `discovery/discovery.md`, `AGENTS.md`, `README.md`, `index.html` (prototipo observado).
