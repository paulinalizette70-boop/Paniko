# Bitácora de pruebas — Paniko

## Histórico verificado v0.1.0

- **4 de noviembre de 2026:** 9 pruebas automatizadas aprobadas, 0 fallidas.
- [Evidencia original de consola](evidencia-ejecucion-2026-11-04.txt).
- [Ejecución anterior en GitHub Actions](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41957663860) — completada correctamente.

## Versión 0.2.0: inventario y MySQL

- **Pruebas locales:** 14 aprobadas, 0 fallidas, 1 omitida (la que requiere servidor MySQL).
- **Método local:** `node --test tests/*.test.js` en Node.js 22.16.0, con adaptador JSON para las pruebas que requieren persistencia.
- **MySQL:** implementación y prueba `CP-15` disponibles; resultado en [GitHub Actions](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41960369156) **verificado como success**, incluyendo la integración MySQL en el workflow.
- **Aceptación con Ale Sánchez:** no realizada ni afirmada.

Las pruebas de v0.2 documentan entradas, salidas, rechazo por inventario insuficiente y ausencia de consumos parciales en la simulación local. La garantía transaccional del adaptador MySQL debe verificarse en la ejecución remota.
