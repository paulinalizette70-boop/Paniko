# ADR-004 — Persistencia MySQL y transacciones de inventario

**Fecha:** 4 de noviembre de 2026. **Estado:** implementado en código; validación MySQL mediante CI.

## Contexto

El usuario confirmó el uso de MySQL y la prioridad funcional de inventario. La versión 0.1.0 utilizaba JSON local sin bloqueo de concurrencia ni garantías transaccionales.

## Decisión

1. Utilizar MySQL 8.0.16+ con InnoDB y tablas normalizadas para ingredientes, recetas, movimientos de inventario y registro de producción.
2. Utilizar `mysql2/promise` con consultas parametrizadas y pool.
3. Para `stock-in`, bloquear el ingrediente con `SELECT ... FOR UPDATE`, incrementar existencia y escribir un movimiento en la **misma transacción**.
4. Para `produce`, bloquear por ID en orden estable todos los ingredientes de la receta, verificar existencias, descontarlas y registrar movimientos, consumo y lote de producción en una **transacción**. Si hay insuficiencia se ejecuta rollback y no hay descuentos parciales.
5. El adaptador JSON continúa solo para pruebas locales y compatibilidad, no como base principal de la aplicación.

## Alternativas consideradas

- Seguir con JSON: rápido, pero no apto para inventario concurrente.
- Escribir actualizaciones sin transacciones: riesgo de pérdida de stock o consumos parciales.
- MySQL con transacciones y bloqueos: requiere configuración, pero se ajusta al acta y protege el inventario.

## Consecuencias

**Ventajas:** integridad referencial, registro histórico, consultas parametrizadas y atomicidad al descontar.
**Costos:** servicio MySQL obligatorio para arranque normal; necesidad de controlar credenciales y migraciones. Los datos JSON previos no se migran automáticamente.

## Restricciones y futuro

Todavía no hay autenticación ni permisos (no desplegar sin ellos); no se convierten unidades automáticamente; aún no existe cierre de lotes ni merma. Los costos son estimaciones. Las pruebas MySQL requieren base aislada terminada en `_test`.
