# Funcionalidades

Organizadas por **épica** y luego por **historia de usuario** (formato US-NNN). Trazabilidad a `docs/ACCEPTANCE_CRITERIA.md` y reglas `05_reglas_de_negocio.md`.

## Épica 1: Carga y validación del listado

### US-001 — Importar archivo de canciones
**Como** DJ **Quiero** importar PDF/DOCX/TXT/CSV/TSV desde el panel **Para** usar la lista oficial sin reescribirla.

**Criterios de aceptación**:
- [ ] El input acepta las extensiones declaradas e informa formato incompatible.
- [ ] PDF/DOCX cargan librería bajo demanda; sin internet el error indica usar "Pegar texto".
- [ ] Al terminar se informa "N nueva(s), M duplicado(s) omitido(s)".

**Reglas relacionadas**: RN-IMP-01, RN-IMP-02, RN-IMP-03, RN-X-01

### US-002 — Pegar texto como fallback offline
**Como** DJ **Quiero** pegar una canción por línea (`Artista - Titulo`, `Titulo — Artista`, solo `Titulo`, filas de Sheets/CSV) **Para** cargar la lista sin internet.

**Criterios de aceptación**:
- [ ] Acepta separadores `-`, `—`, `,`, `;`, tab; salta encabezado; elimina numeración.
- [ ] Título solo se guarda sin artista; nada se descarta en silencio.

**Reglas relacionadas**: RN-IMP-01, RN-IMP-02, RN-IMP-04

### US-003 — Revisar lista antes de comenzar
**Como** DJ **Quiero** ver la lista completa con buscador y estados (Disponible/Sorteada/Reproducida/Anulada) **Para** corregir errores antes del show.

**Criterios de aceptación**:
- [ ] Contadores Total/Disponibles/Sorteadas siempre visibles.
- [ ] Filtro por título+artista; entradas incompletas marcadas ("Artista no especificado").

**Reglas relacionadas**: RN-IMP-04

### US-004 — Cargar demo
**Como** DJ **Quiero** un set de 12 canciones de prueba en un clic **Para** ensayar proyector, audio y flujo sin la lista real.

**Criterios de aceptación**:
- [ ] Inserta las 12 canciones sin duplicar las ya cargadas.

**Reglas relacionadas**: RN-IMP-03

## Épica 2: Sorteo en vivo

### US-005 — Sortear canción sin repetición
**Como** DJ **Quiero** sortear uniformemente entre disponibles con un botón **Para** mantener justicia y ritmo.

**Criterios de aceptación**:
- [ ] Con 0 elegibles el botón está deshabilitado; con 1 el resultado es determinista.
- [ ] Resultado comprometido en estado antes de animar (verificable en código + prueba).
- [ ] Sorteada no vuelve a elegible en la partida.

**Reglas relacionadas**: RN-SOR-01, RN-SOR-02, RN-SOR-03, RN-SOR-04, RN-SOR-05

### US-006 — Animar ruleta y revelar
**Como** público **Quiero** ver la ruleta girar (~2.7 s) y luego título+artista gigantes **Para** vivir el show y marcar mi cartón.

**Criterios de aceptación**:
- [ ] Animación previa a la revelación en la pública; título/artista legibles a distancia.
- [ ] Sin controles privados en la pública; sin estados contradictorios entre ventanas.

**Reglas relacionadas**: RN-SOR-02, RN-PUB-01, RN-PUB-02, RN-PUB-03

### US-007 — Confirmar reproducida / Anular con motivo
**Como** DJ **Quiero** marcar `played` o anular (`void`) con motivo **Para** dejar constancia y excluir la canción.

**Criterios de aceptación**:
- [ ] Solo habilitado con `current` en `drawn` y sin giro en curso.
- [ ] Anulación exige confirmación con motivo; `void` no reingresa sin regla explícita.
- [ ] ⚠️ Brecha actual: motivo no se persiste como campo (IN-02).

**Reglas relacionadas**: RN-HIS-02, RN-HIS-03, RN-SOR-06

## Épica 3: Doble pantalla

### US-008 — Abrir pantalla pública en ventana independiente
**Como** DJ **Quiero** abrir la pública en popup movible al proyector **Para** separar operación y show.

**Criterios de aceptación**:
- [ ] Si el popup se bloquea, mensaje que indica permitir emergentes.
- [ ] Reenfoca si ya está abierta; sincroniza a los ~250 ms.

**Reglas relacionadas**: RN-PUB-01, RN-PUB-02

## Épica 4: Historial y evidencia

### US-009 — Registrar historial auditable
**Como** DJ **Quiero** cada sorteo con Nº, título, artista, hora y estado **Para** transparencia ante discusiones.

**Criterios de aceptación**:
- [ ] Orden correlativo `n`; hora `es-AR HH:MM:SS`; estado actualizado in-place.

**Reglas relacionadas**: RN-HIS-01, RN-HIS-03

### US-010 — Exportar historial CSV
**Como** DJ **Quiero** descargar `music-bingo-historial.csv` (BOM, comillas RFC) **Para** guardar evidencia post-evento.

**Criterios de aceptación**:
- [ ] Columnas `Nº,Título,Artista,Estado,Hora`; abre bien en Excel.

**Reglas relacionadas**: RN-HIS-04

## Épica 5: Resiliencia y portabilidad (transversal)

### US-011 — Operar la ruta principal offline
**Como** DJ **Quiero** sorteo + pública + historial sin internet **Para** que el show no dependa de la red del local.

**Criterios de aceptación**:
- [ ] Demo/pegar texto → sortear → pública → confirmar → exportar funciona offline; dependencias CDN documentadas con contingencia.

**Reglas relacionadas**: RN-X-01

### US-012 — No perder la partida ante refresh sin avisar
**Como** DJ **Quiero** recuperación ante recarga/cierre o aviso claro de su ausencia **Para** no quedarme sin show a mitad de evento.

**Criterios de aceptación**:
- [ ] ⚠️ Hoy sin persistencia: debe avisarse o implementarse (P0, ver `10_preguntas_abiertas.md`).

**Reglas relacionadas**: RN-X-03

### US-013 — Vaciar / Reiniciar con salvaguardas
**Como** DJ **Quiero** vaciar la lista o reiniciar la partida solo con confirmación (doble si hay historial) **Para** evitar borrados accidentales.

**Criterios de aceptación**:
- [ ] `confirm()` simple sin historial; doble con historial; resetea contadores y mensajes.

**Reglas relacionadas**: RN-SES-02
