# Bitácora de pruebas — Paniko

## Histórico verificado v0.1.0

- **4 de noviembre de 2026:** 9 pruebas automatizadas aprobadas, 0 fallidas.
- [Evidencia original de consola](evidencia-ejecucion-2026-11-04.txt).
- [Ejecución anterior en GitHub Actions](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41957663860) — completada correctamente.

## Versión 0.2.0: inventario y MySQL

- **Pruebas locales:** 14 aprobadas, 0 fallidas, 1 omitida (la que requiere servidor MySQL).
- **Método local:** `node --test tests/*.test.js` en Node.js 22.16.0, con adaptador JSON para las pruebas que requieren persistencia.
- **MySQL:** implementación y prueba `CP-15` disponibles; resultado en GitHub Actions **pendiente de verificación**.
- **Aceptación con Ale Sánchez:** no realizada ni afirmada.

Las pruebas de v0.2 documentan entradas, salidas, rechazo por inventario insuficiente y ausencia de consumos parciales en la simulación local. La garantía transaccional del adaptador MySQL debe verificarse en la ejecución remota.

## Evidencia v0.3.0 — importador privado (sin publicar fórmulas)

- Se ejecutó `npm test` localmente con **21 subpruebas: 19 aprobadas, 0 fallidas y 2 omitidas**. Las dos pruebas omitidas requieren la instancia MySQL aislada del CI.
- CP-16 a CP-20: validaciones del catálogo y protección frente a referencias inválidas, con datos enteramente ficticios.
- CP-21: integración MySQL de staging, idempotencia y aislamiento de rutas HTTP; ejecutar en GitHub Actions con `MYSQL_TEST=1`.
- [Instrucciones de importación local privada](../recetas/importacion-privada.md).

> Este registro no implica que se haya importado el catálogo real en el servidor MySQL de la panadería. Esa operación solo puede efectuarse con las credenciales locales de la Product Owner.
