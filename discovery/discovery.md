# Discovery — Music Bingo DJ (Olmos Nahuel)

**Fecha**: 2026-10-13
**Fuentes investigadas**: 3 competidores (ver `discovery/sources/`)

## 1. Problema que resuelve

Animar un bingo musical en vivo sin depender de cartones impresos ni de apps genéricas que no piensan en show en vivo, y evitar errores de sorteo manual (repetidos, papelitos, discusiones) que rompen el evento.

## 2. Usuarios / roles

- **DJ/operador**: opera el sorteo, carga la lista, anula con motivo, exporta historial. En esta ocasión, un solo operador (el dueño).
- **Público**: mira la pantalla pública/proyector con cartón físico en mano, canta cuando completa.

## 3. Casos de uso

1. Como DJ, quiero sortear canciones sin repetir para no romper el show.
2. Como público, quiero ver la ruleta y el título legible en el proyector para seguir el juego.
3. Como DJ, quiero anular un sorteo con motivo y exportar el historial para dejar constancia de incidencias.

## 4. Competidores / soluciones existentes

| Competidor | Problema que resuelve | Pricing | Diferenciadores |
|---|---|---|---|
| Bingo Maker | Bingo con canciones + plantillas por década/género para animar grupos | (no publicado, usa créditos) | 50 plantillas + hoja de control + playlist YouTube; música reproducida aparte por el DJ |
| Bingos Musicales (.ar) | Bingo listo PDF + Spotify para juntadas en Argentina | Express 15 cartones ARS 7.249; resto (no publicado en home) | Catálogo temático argentino, doble versión Express/Extended, personalizado |
| Sacodejuegos | Generar cartones PDF personalizados desde Excel | (no publicado, uso gratuito en página) | Simpleza (pegar y generar PDF con combinaciones únicas); sin sorteo en vivo |

**Notas**: ninguno hace sorteo digital en vivo con doble pantalla operador/pública. El diferencial de Music Bingo DJ es sorteo en vivo + pantalla pública sincronizada + operación portable offline. A futuro: integración VirtualDJ, cartones propios, theming por local.

## 5. Funcionalidades necesarias

- Sorteo sin repetición en la sesión + mensaje claro de lista agotada.
- Importar Excel/CSV (.xlsx/.csv) + pegar texto como fallback offline: formato `Artista - Titulo`, copiado en texto plano desde Google Sheets y desde CSV.
- Pantalla pública sincronizada (no revela antes de la animación) + título y artista legibles en proyector.
- Anulación con motivo obligatorio + historial con hora/estado/motivo + exportación CSV.

## 6. Funcionalidades opcionales

- Generar/imprimir cartones propios desde la app.
- Estadísticas del evento (temas cantados, duración).
- Theming por local (logo y colores) — backlog, por ahora un solo diseño fijo.
- Integración automática con VirtualDJ — futuro, en v1 es manual.

## 7. Reglas de negocio

- No repetir canción ya sorteada durante la sesión, salvo regla futura aprobada explícitamente.
- El resultado aleatorio se decide antes de la animación; la ruleta solo lo representa.
- La anulación exige motivo y la canción anulada no vuelve a elegible sin regla explícita.
- La lista se bloquea una vez iniciada la partida salvo acción administrativa registrada (propuesto desde auditoría, a confirmar en KB).

## 8. Integraciones

- Ninguna integración externa obligatoria para la v1: VirtualDJ manual, Excel/Sheets vía archivo o pegado manual.
- Futuro: VirtualDJ (mostrar/disparar) y lectura directa de Google Sheets; cartones propios.

## 9. Restricciones

- Offline-first durante el evento; sin depender de internet para la ruta principal.
- Portable y simple: abrir en Chrome/Edge sin instalar nada.
- Plazo: un solo evento en dos días, un solo operador, un solo diseño.
- Stack: lo propone `kb-creator` en la próxima fase.

## 10. Riesgos

- **Supuesto sin probar**: que el formato `Artista - Titulo` + CSV/Sheets cubra toda la lista real sin filas dudosas — validar con la lista del evento antes del show.
- **Riesgo**: refresh/cierre a mitad de show borra lista + historial (estado solo en memoria, sin persistencia).
- **Riesgo**: la pública revela el resultado 2.75s antes que el operador (spoiler en proyector).
- **Riesgo**: PDF/DOCX dependen de CDN (pdf.js/mammoth) y fallan sin internet sin contingencia probada.
- **Riesgo**: timeout huérfano tras reinicio y vaciado de lista a mitad de giro.

## 11. Preguntas abiertas

- ¿El bloqueo de lista una vez iniciada entra en v1-dos-días o post-evento?
- ¿Columnas exactas del Excel del evento (encabezado, separador `,`/`;`/tab, encoding)?
- ¿Formato exacto esperado de la integración futura con VirtualDJ?
