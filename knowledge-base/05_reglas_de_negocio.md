# Reglas de Negocio

Cada regla tiene código único `RN-{DOMINIO}-{NN}` para trazabilidad. Origen principal: `docs/PRODUCT_BRIEF.md`, `docs/DECISIONS.md`, `AGENTS.md`, `docs/ACCEPTANCE_CRITERIA.md`, `discovery/discovery.md` §7, `index.html` (comportamiento observado).

## Dominio: Sorteo (RN-SOR)

- **RN-SOR-01**: Una canción sorteada (`drawn/played/void`) nunca vuelve a elegible en la misma partida, salvo regla futura aprobada explícitamente. — Base de la justicia del juego (D-002).
- **RN-SOR-02**: El resultado se decide y compromete en estado **antes** de iniciar la animación; la ruleta solo lo representa, jamás lo elige por posición visual. (D-003).
- **RN-SOR-03**: Selección uniforme entre elegibles con `crypto.getRandomValues` + rejection sampling (`secureIndex`), evitando sesgo de módulo.
- **RN-SOR-04**: Con cero elegibles (vacía o agotada) el sorteo está bloqueado (`drawBtn.disabled`) y el estado muestra mensaje claro; jamás se genera un resultado ficticio.
- **RN-SOR-05**: Con una sola elegible, esa canción es el único resultado posible (determinista).
- **RN-SOR-06**: Durante el giro (`spinning=true`, 2750 ms) se bloquean sorteo y confirmación; el timeout huérfano tras reinicio/vaciado mid-giro es un riesgo conocido (ver `10_preguntas_abiertas.md`).

## Dominio: Importación (RN-IMP)

- **RN-IMP-01**: Fuentes aceptadas: archivo PDF/DOCX/TXT/CSV/TSV + pegado de texto + demo. PDF/DOCX requieren internet (CDN); el resto es offline.
- **RN-IMP-02**: Ninguna entrada se descarta silenciosamente: líneas vacías se ignoran; duplicados se cuentan ("N duplicado(s) omitido(s)"); si nada se detecta se informa y se sugiere pegar texto.
- **RN-IMP-03**: Dedupe por clave normalizada (minúsculas, sin diacríticos, espacios colapsados) de `título|artista`, tanto intra-importación como contra la lista existente.
- **RN-IMP-04**: Título obligatorio; artista opcional ("Artista no especificado"). El operador debe poder revisar la lista completa (con filtro) antes de comenzar.
- **RN-IMP-05**: ⚠️ Brecha conocida: el input acepta `.pdf,.docx,.txt,.csv,.tsv` pero **no `.xlsx`**, aunque discovery exige "Excel/CSV (.xlsx/.csv)". Registrar como IN-05.

## Dominio: Partida / Sesión (RN-SES)

- **RN-SES-01** (propuesto, a confirmar): La lista se bloquea al iniciar la partida; cualquier cambio posterior requiere acción administrativa registrada. El prototipo hoy permite vaciar/reiniciar mid-show solo con `confirm()`, sin bloqueo real (ver IN-01).
- **RN-SES-02**: Vaciar/reiniciar exige confirmación; con historial existente se pide segunda confirmación. Ambas acciones borran canciones + historial + `current`.

## Dominio: Pantalla pública (RN-PUB)

- **RN-PUB-01**: La pública nunca expone controles privados; es solo lectura (ruleta, título/artista, contador, últimas 5).
- **RN-PUB-02**: El estado se actualiza sin contradicciones entre ventanas (mismo snapshot por broadcast en cada `render()` + al comprometer).
- **RN-PUB-03** (riesgo P0): El broadcast es inmediato al comprometer, por lo que la pública muestra el título ~2.75 s antes de que termine la animación del operador (spoiler). Requiere decisión de diseño (retrasar broadcast o estado `spinning` en pública).

## Dominio: Historial e incidencias (RN-HIS)

- **RN-HIS-01**: Todo sorteo genera entrada con canción + hora/orden (`n`, `time es-AR`) + estado posterior.
- **RN-HIS-02**: Anular exige motivo y confirmación; la canción anulada queda excluida (`void` terminal) y no reingresa sin regla explícita. ⚠️ Brecha: el prototipo solo pide `confirm()` genérico sin campo de motivo persistido (IN-02).
- **RN-HIS-03**: Correcciones, ausencias y anulaciones quedan identificadas en el historial con estado visible (`Sorteada/Reproducida/Anulada`).
- **RN-HIS-04**: Exportación CSV (`Nº,Título,Artista,Estado,Hora`, comillas RFC + BOM) disponible para evidencia post-evento.

## Dominio: Excepciones globales

- **RN-X-01 (Offline-first)**: La ruta principal funciona sin internet; toda dependencia online (CDN pdf.js/mammoth) debe estar documentada con contingencia probada (pegar texto).
- **RN-X-02 (VirtualDJ manual)**: El sistema jamás afirma controlar VirtualDJ; el DJ busca y reproduce manualmente (D-001, D-004 pendiente de auditoría).
- **RN-X-03 (Recuperación)**: Un refresh no debe perder la partida silenciosamente; hoy no hay persistencia, por lo que hasta implementar recuperación debe informarse con claridad (criterio de aceptación).
- **RN-X-04 (Operabilidad)**: Controles grandes, distinguibles y utilizables rápidamente durante el show; sin interacciones complejas.
