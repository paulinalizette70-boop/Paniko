# Paniko — protección de confirmaciones repetidas

## Qué problema corrige
Un doble clic o reintento podía confirmar dos lotes distintos y descontar ingredientes o productos dos veces. El Issue #29 registra la reproducción con datos ficticios. También se resuelve el precio \`$NaN\` que veía el rol operador (Issue #28).

## Cambios
- Solicitudes de producción tradicional, formatos de masa, subpreparaciones y movimientos de productos terminados pueden llevar \`operationId\` (UUID).
- El servidor registra \`operationId\`, tipo, hash de contenido y respuesta dentro de la **misma transacción InnoDB** que descuenta existencias.
- Si una solicitud igual se repite, devuelve el resultado original; si reutiliza el ID con otra cantidad o tipo, responde 409.
- Las pantallas envían el ID y bloquean los botones durante la confirmación. Con pedidos antiguos que no lo envían, la API conserva compatibilidad, pero **no** garantiza idempotencia.
- La tabla nueva no guarda contraseñas, fórmulas ni recetas.

## Antes de instalar
1. **No fusionar automáticamente con main.** La rama depende de #27, #22 y #21, aún en revisión.
2. Exportar y verificar un respaldo completo de MySQL, además del código local.
3. Probar con una base MySQL aislada que termine en \`_test\`; no ejecutar demo en la base real.
4. Revisar la migración sin aplicarla: \`node --env-file=.env scripts/migrate-operation-requests.js\`.
5. **Solo después de confirmar el respaldo y la integración de ramas**, ejecutar en la instalación prevista: \`node --env-file=.env scripts/migrate-operation-requests.js --apply --confirm-backup\`.
6. Comprobar con datos ficticios: mismo ID dos veces -> un lote y una salida; ID reutilizado con datos distintos -> 409; roles operador/admin; historial consistente.
7. Validar también doble clic en formatos, subpreparaciones, ventas y la corrección de precios.

## Validación requerida
- Tests unitarios sintéticos del protocolo de deduplicación.
- CI Node + MySQL aislado; **faltan pruebas de concurrencia y reversión con MySQL real**.
- Aceptación manual en Windows tras respaldo. No declarar resuelto hasta pasar estas verificaciones.

Nunca publicar \`.env\`, \`private/\`, fórmulas ni dumps reales.
