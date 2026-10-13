# Actores y Roles

## Actores del sistema

| Actor | Descripción | Cómo interactúa |
|-------|-------------|-----------------|
| DJ / Operador (único, dueño) | Administra lista, ejecuta sorteos, registra played/void, exporta historial, abre la pública | Panel privado en `index.html`: botones grandes (Sortear, Marcar reproducida, Anular, Importar, Vaciar, Reiniciar, Exportar, Abrir pública), filtro de búsqueda, lista y historial |
| Público | Participantes con cartón físico que miran el proyector y cantan al completar | Solo mira la ventana pública (popup): ruleta, título/artista gigante, contador, últimas 5; sin ningún control |
| Organizador (indirecto) | Responsable del evento que recibe evidencia y decisiones ante incidencias | Fuera de la app: recibe CSV exportado e informe verbal de anulaciones |

No hay registro, login, ni roles configurables en v1. Un solo operador, un solo diseño, un solo evento.

## RBAC — Matriz de permisos

Sin autenticación ni autorización por roles (decisión de simplicidad portable). Matriz efectiva por superficie:

| Superficie | Ver lista | Importar/vaciar | Sortear | Confirmar / Anular | Exportar | Abrir pública | Ver pública |
|------------|-----------|-----------------|---------|--------------------|----------|---------------|-------------|
| Panel operador (ventana principal) | Sí | Sí (con `confirm()`) | Sí | Sí | Sí | Sí | N/A |
| Pantalla pública (popup) | Solo últimas 5 (títulos) | No | No | No | No | No | Sí |

Separación exigida: la pública **no expone controles privados** (criterio de aceptación) — el HTML generado por `publicHTML()` no contiene botones de operación, solo listeners de `BroadcastChannel` y `Escape` para salir de fullscreen.

## Rutas públicas

No hay router (single-file). Superficies accesibles sin autenticación (todo es local):

- `index.html` — panel operador (abrir directo en Chrome/Edge).
- Ventana popup pública (`window.open('', 'musicBingoPublic')` + `document.write(publicHTML())`) — debe moverse al proyector/segunda pantalla; requiere permitir ventanas emergentes para archivos locales.
- Sin URLs remotas, sin deep links, sin multi-sesión.

**Fuentes**: `docs/PRODUCT_BRIEF.md` (Usuarios), `docs/ACCEPTANCE_CRITERIA.md` (Pantalla pública), `discovery/discovery.md` §2, `index.html` (`$()` bindings, `publicHTML()`, `openPublic`).
