# Propuesta integrada en rama: panel visual de cuidado de masa madre

**Estado:** código implementado y probado localmente como cambio acumulable posterior a Paniko 0.8.3. Esta rama **no** es una versión instalable todavía; no cambia el `package.json` ni requiere migrar MySQL. No fusionar con `main` hasta probarla en la panadería.

## Incluye

- Tarjetas por cultivo, con frasco **ilustrativo**, peso obtenido de `currentWeightGrams` en la API (derivado del inventario real cuando está vinculado), última alimentación, ubicación, próxima revisión y barra de horario.
- Estados de cuidado calculados a partir de `lastFedAt`, `feedEveryHours`, `location`, `inventoryLinked` y `active`: al día, próximo, atrasado, refrigerado, sin alimentación, sin vínculo y seguimiento pausado.
- Accesos rápidos: Alimentar, Corregir peso y Cambiar ubicación (el cambio debe guardarse en configuración para surtir efecto).
- Alimentación con resultado previsto en vivo y confirmación explícita; las operaciones reales siguen usando `/api/sourdough/starters/:id/feed` y su transacción MySQL existente. No se escriben movimientos hasta confirmar.
- Historial visual de alimentaciones recientes y opción de ver hasta 50 registros, consultados desde la API existente. No se inventan registros de cambios de ubicación si no existen en el backend.
- Bloque en Inicio que muestra las masas madre y los recordatorios prioritarios, con acceso a la sección y a la alimentación. Se actualiza al entrar, al regresar a la ventana y cada minuto mientras Paniko esté abierto.
- Estado de cuidados, **no** diagnóstico de actividad, inocuidad o madurez de la masa madre. El frasco no representa volumen real: muestra una escala decorativa.

## Privacidad y seguridad

No se incluyen fórmulas, catálogos, credenciales, valores de inventario reales ni archivos de `private/`. La interfaz sigue usando las rutas autenticadas; no hay cambios en MySQL ni en procesos de descontar existencias. Las nuevas llamadas son GET de consulta; los POST siguen requiriendo interacción y confirmación del operador. Los avisos funcionan en la aplicación al abrirla; no hay notificaciones push ni trabajo en segundo plano.

## Verificación

Ejecutar `npm.cmd test` (Windows) o `npm test` (macOS/Linux). Casos `VIS-01..05`: temporización, refrigerador, horarios no conocidos, elementos UI y recurso estático. Integraciones con MySQL se cubren por las pruebas preexistentes al ejecutar CI con `MYSQL_TEST=1` en una BD aislada `paniko_test`.

## Pendiente antes de liberar una versión agrupada

- Evaluación visual con usuaria real en pantalla de escritorio y móvil.
- Prueba de una alimentación real y de actualización inmediata en la interfaz de Inventario (con respaldo y cantidades reales).
- Integrar cambios junto con otras funciones pendientes y crear **una sola actualización** instalable desde GitHub, en lugar de ZIPs consecutivos.
