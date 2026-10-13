# Criterios de aceptación iniciales

Estos criterios deben revisarse y convertirse en pruebas durante SDD/OPSX. No se consideran verificados hasta ejecutar las pruebas.

## Importación
- [ ] El operador puede importar un archivo compatible o pegar texto de una lista.
- [ ] La aplicación informa cuántas canciones detectó y cuáles filas requieren corrección.
- [ ] Título y artista se conservan correctamente; entradas incompletas no se descartan silenciosamente.
- [ ] El operador puede revisar la lista completa antes de comenzar.

## Sorteo
- [ ] Con cero canciones elegibles, no se puede sortear.
- [ ] Con una canción elegible, esa canción es la única posible.
- [ ] Cada canción elegible tiene la misma probabilidad según el algoritmo implementado.
- [ ] El resultado se decide antes de iniciar la animación.
- [ ] Una canción sorteada no vuelve a aparecer como elegible en esa partida.
- [ ] La lista agotada produce un mensaje claro y no genera un resultado ficticio.

## Pantalla pública
- [ ] Puede abrirse en una ventana independiente.
- [ ] Antes de revelar el resultado, presenta la animación de ruleta.
- [ ] Al terminar, muestra título y artista legibles a distancia.
- [ ] La pantalla pública no expone controles privados de operador.
- [ ] El estado se actualiza sin mostrar resultados contradictorios entre ventanas.

## Historial y fallos
- [ ] Se registran canción sorteada, hora/orden y estado posterior.
- [ ] Una anulación exige motivo y no devuelve la canción al conjunto disponible sin una regla explícita.
- [ ] El operador puede exportar el historial.
- [ ] Un refresco accidental no pierde silenciosamente la partida activa, o se informa con claridad si la recuperación no está implementada.

## Uso en evento
- [ ] La ruta principal funciona sin internet, o las dependencias online están documentadas con un procedimiento de contingencia probado.
- [ ] Los botones principales son distinguibles y utilizables rápidamente.
- [ ] El DJ puede operar el sorteo sin que la aplicación pretenda controlar VirtualDJ.
