# Casos de prueba de Paniko (histórico y versión de medio término)

Los ingredientes de las pruebas son **ficticios**, no recetas reales. Los casos CP-01 a CP-24 se documentaron en etapas anteriores (0.1 a 0.4), y los conservamos como historial. Para la demo de la versión **0.7.2** utilizaremos además el [plan de pruebas manuales DM-01 a DM-10](plan-pruebas-demo.md). Los resultados deben verificarse en la [bitácora](registro-ejecuciones.md) y en GitHub Actions.

| Caso | Tipo | Acción / datos | Resultado esperado | Archivo |
| --- | --- | --- | --- | --- |
| CP-01–03 | Unitarios/API | Alta de ingrediente, nombre vacío, costo negativo | Alta válida o rechazo correcto | `tests/domain.test.js`, `tests/integration.test.js` |
| CP-04–05 | Unitarios/API | Ficha técnica y consulta | Receta vinculada a ingredientes | `tests/domain.test.js`, `tests/integration.test.js` |
| CP-06–09 | Unitarios/API | Escalado, validaciones, faltantes | Cantidades y estimación correctas, sin descuento al previsualizar | `tests/domain.test.js`, `tests/integration.test.js` |
| CP-10 | Unitario JSON | Entrada 2.5 kg con stock inicial 1 | Stock final 3.5 kg y movimiento | `tests/inventory.test.js` |
| CP-11 | Unitario JSON | Entrada cero, negativa o sub-millonésima | Rechazo 400 | `tests/inventory.test.js` |
| CP-12 | Unitario JSON | Confirmar 20 conchas con stock suficiente | Consumo y costo registrados | `tests/inventory.test.js` |
| CP-13 | Unitario JSON | Producción insuficiente | No hay descuento ni lote parcial | `tests/inventory.test.js` |
| CP-14 | Integración HTTP JSON | Entradas, producción, stock insuficiente | HTTP 200/201/409 y movimientos | `tests/inventory.test.js` |
| CP-15 | Integración MySQL | Entrada, transacción de producción, rollback por insuficiencia | Datos relacionales consistentes | `tests/mysql.test.js` |

La integración real con MySQL se ejecuta **solo** si `MYSQL_TEST=1` y `DB_NAME` termina en `_test`; la CI configura una base temporal `paniko_test`. No se atribuyen pruebas de usuario o recetas reales todavía.

## Casos añadidos

Pruebas con **datos sintéticos**, nunca fórmulas de la panadería:

| ID | Tipo | Caso | Resultado esperado | Archivo |
| --- | --- | --- | --- | --- |
| CP-16 | Unitario | Validar catálogo JSON y sus referencias | Datos válidos y conteos correctos | `tests/private-catalog.test.js` |
| CP-17 | Unitario | Admitir datos incompletos y unidades por revisar | Advertencias sin inventar cantidades | `tests/private-catalog.test.js` |
| CP-18 | Unitario | Rechazar referencias a subrecetas inexistentes | Error antes de importación | `tests/private-catalog.test.js` |
| CP-19 | Unitario | Rechazar producto con referencia inválida y IDs duplicados | Error de validación | `tests/private-catalog.test.js` |
| CP-20 | Unitario | Evitar un catálogo vacío o rellenos de referencia inválida | Error de validación | `tests/private-catalog.test.js` |
| CP-21 | MySQL integración | Importación duplicada, datos JSON y aislamiento de HTTP | Importación idempotente; ningún endpoint público | `tests/private-catalog-mysql.test.js` |

## Evidencia de ejecución

Última ejecución de GitHub Actions: **21 pruebas aprobadas, 0 fallidas y 0 omitidas**. Incluye pruebas de integración MySQL con datos ficticios. [Ver ejecución y registro de pruebas](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41965295559).

## Casos históricos de conversión de unidades

| ID | Tipo | Descripción | Resultado esperado | Ubicación |
| --- | --- | --- | --- | --- |
| CP-22 | Unitario | Receta con harina expresada en g e ingrediente en kg, agua en l y stock en ml; rechazo de peso/volumen mezclados | Cantidades normalizadas, errores de incompatibilidad y precisión | `tests/domain.test.js` |
| CP-23 | Inventario JSON | Entrada de 250 g en stock por kg, receta de prueba de 500 g; producción y rechazo de unidad inválida | Stock y movimientos en kg, sin modificaciones ante error | `tests/inventory.test.js` |
| CP-24 | Integración MySQL | Entrada, ficha técnica y producción ficticias expresadas en g con inventario en kg | Consumos consistentes en kg, sin modificar stock cuando una unidad es incompatible | `tests/mysql.test.js` |

La ejecución [v0.4.0 en GitHub Actions](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41968225354) confirma **24 aprobadas, 0 fallidas y 0 omitidas**, incluidas las tres nuevas subpruebas de conversión y MySQL con datos ficticios.


## Pruebas de la versión de medio término (0.7.2)

En `main` ya contamos con archivos adicionales para pruebas unitarias, integración y seguridad. Entre ellas:

| Área actual | Archivo de pruebas | Qué revisa |
| --- | --- | --- |
| Conversiones de Agua y Huevo | [`unit-conversions-egg-water.test.js`](../../tests/unit-conversions-egg-water.test.js) | Equivalencias específicas y rechazo de conversiones que no corresponden |
| Fichas técnicas | [`catalog-to-technical-sheet.test.js`](../../tests/catalog-to-technical-sheet.test.js) | Creación de ficha, uso de ingredientes existentes, transacción y control de stock |
| Porcentaje panadero | [`bakers-percent.test.js`](../../tests/bakers-percent.test.js) | Porcentajes basados en el peso total de harinas |
| Inicio de sesión y roles | [`auth-security.test.js`](../../tests/auth-security.test.js) | Autorización y protección de rutas |
| Finanzas y roles | [`roles-and-finances.test.js`](../../tests/roles-and-finances.test.js) | Separación entre operaciones y datos financieros |
| Inventario | [`stock-adjustments.test.js`](../../tests/stock-adjustments.test.js) | Salidas y ajustes de cantidades |
| Producción | [`production-planning.test.js`](../../tests/production-planning.test.js) | Vista previa y estimación según inventario |
| Historial | [`production-history.test.js`](../../tests/production-history.test.js) | Consulta de lotes y movimientos |

**Evidencia automática:** [GitHub Actions, `main`, ejecución aprobada de 0.7.2](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43374837592).

**Importante:** esta ejecución técnica no equivale a haber probado toda la demo manual. Los casos de la Sprint Review están en [DM-01 a DM-10](plan-pruebas-demo.md) y permanecen sin resultado hasta ejecutarlos con datos ficticios.
