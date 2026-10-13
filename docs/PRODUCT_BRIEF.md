# Product Brief — Music Bingo DJ

## Visión
Herramienta local para que DJ Olmos Nahuel gestione sorteos transparentes de canciones en eventos de Bingo Musical y proyecte una experiencia visual atractiva.

## Usuarios
- Operador: el DJ, que administra la lista, realiza sorteos y registra incidencias.
- Público: participantes que ven la ruleta, el resultado y el historial de canciones sorteadas.

## Contexto operativo
- DJ software: VirtualDJ.
- Fuente de canciones: listado que puede entregarse como PDF o documento.
- Salida pública: animación de ruleta y luego título + artista.
- Política de repetición: no repetir canciones ya sorteadas en la misma partida.
- Reproducción: manual en VirtualDJ en la primera versión.

## Flujo principal
1. El operador carga/importa la lista oficial.
2. El sistema valida y muestra cuántas canciones quedaron reconocidas; el operador puede corregir errores antes de iniciar.
3. Se inicia una partida y se bloquea la lista usada para esa partida, salvo una acción administrativa registrada.
4. Al pedir el siguiente sorteo, el sistema selecciona uniformemente una canción entre las aún disponibles.
5. El resultado queda comprometido en el estado de la partida antes de iniciar la animación.
6. La pantalla pública anima la ruleta y revela título y artista.
7. El DJ busca y reproduce la canción manualmente en VirtualDJ.
8. El operador registra el estado correspondiente y continúa. Una canción sorteada no vuelve a estar disponible.
9. El operador puede exportar el historial y guardar evidencia del resultado de la sesión.

## Principios
- Justicia: selección uniforme entre canciones elegibles.
- Transparencia: historial visible y auditable.
- Resiliencia: recuperación ante recarga/cierre y manejo de fallos.
- Operabilidad: controles grandes y legibles; no exigir interacciones complejas mientras el DJ trabaja.
- Portabilidad: ejecutar localmente y minimizar dependencias externas.

## Fuera de alcance inicial
- Seleccionar/reproducir automáticamente en VirtualDJ.
- Aplicación móvil nativa.
- Sincronización en la nube o múltiples operadores remotos.
- Verificación automática de cartones de participantes, salvo que se agregue como requisito futuro.
