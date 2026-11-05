# Bitácora de pruebas — Paniko

## Histórico verificado v0.1.0

- **4 de noviembre de 2026:** 9 pruebas automatizadas aprobadas, 0 fallidas.
- [Evidencia original de consola](evidencia-ejecucion-2026-11-04.txt).
- [Ejecución anterior en GitHub Actions](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41957663860) — completada correctamente.

## Versión 0.2.0: inventario y MySQL

- **Pruebas locales:** 14 aprobadas, 0 fallidas, 1 omitida (la que requiere servidor MySQL).
- **Método local:** `node --test tests/*.test.js` en Node.js 22.16.0, con adaptador JSON para las pruebas que requieren persistencia.
- **MySQL:** implementación y CP-15 verificados en [GitHub Actions con MySQL temporal](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41960369156).
- **Aceptación con Ale Sánchez:** no realizada ni afirmada.

Las pruebas de v0.2 documentan entradas, salidas, rechazo por inventario insuficiente y ausencia de consumos parciales en la simulación local. El adaptador MySQL se ejercitó en la ejecución remota con datos ficticios, sin que ello represente instalación operativa en la panadería.

## Evidencia v0.3.0 — importador privado (sin publicar fórmulas)

- Se ejecutó `npm test` localmente con **21 subpruebas: 19 aprobadas, 0 fallidas y 2 omitidas**. Las dos pruebas omitidas requieren la instancia MySQL aislada del CI.
- CP-16 a CP-20: validaciones del catálogo y protección frente a referencias inválidas, con datos enteramente ficticios.
- CP-21: integración MySQL de staging, idempotencia y aislamiento de rutas HTTP, ejecutada en GitHub Actions con `MYSQL_TEST=1` y datos ficticios.
- **Ejecución remota verificada:** [21 pruebas aprobadas, 0 fallidas y 0 omitidas](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41965295559). El registro del job muestra `# tests 21`, `# pass 21`, `# fail 0` e incluye CP-15 y CP-21.
- [Instrucciones de importación local privada](../recetas/importacion-privada.md).

> Este registro no implica que se haya importado el catálogo real en el servidor MySQL de la panadería. Esa operación solo puede efectuarse con las credenciales locales de la Product Owner.

## v0.4.0 — Conversión de unidades (CI verificada)

- [Ejecución exitosa en GitHub Actions](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41968225354): **24 pruebas aprobadas, 0 fallidas y 0 omitidas**.
- CP-22 verifica normalización g/kg y ml/l, incompatibilidad y precisión.
- CP-23 verifica movimientos y existencias en la unidad del ingrediente mediante adaptador JSON de pruebas.
- CP-24 verifica importes y consumos normalizados con transacciones MySQL en una base de prueba aislada.
- Todas las recetas en estas pruebas son ficticias; no son pruebas de aceptación con usuarios reales.
