# ADR-003 — Persistencia JSON temporal del MVP 0.1

**Fecha inicial:** 4 de noviembre de 2026. **Estado:** **sustituido** por [ADR-004](ADR-004-mysql-transacciones-inventario.md) para la aplicación principal en v0.2.0.

## Contexto
El MVP original requería registro y fichas técnicas reproducibles sin instalar una base de datos.

## Decisión inicial
Se usó JSON local provisional con Node.js. Se conserva en `src/store.js` para pruebas locales reproducibles y compatibilidad; el servidor actual utiliza MySQL.

## Consecuencias
JSON carece de transacciones multiusuario e integridad referencial SQL. No se recomienda para inventario concurrente ni despliegues de uso real.

## Cambio posterior
El usuario eligió MySQL y desarrollo prioritario de inventario. Consultar [ADR-004](ADR-004-mysql-transacciones-inventario.md).
