# Casos de prueba — Paniko v0.4.0

Los ingredientes de las pruebas son **ficticios**, no recetas reales. Los resultados deben verificarse en la [bitácora](registro-ejecuciones.md).

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

## Nuevos casos: unidades (

| ID | Tipo | Descripción | Resultado esperado | Ubicación |
| --- | --- | --- | --- | --- |
| CP-22 | Unitario | Receta con harina expresada en g e ingrediente en kg, agua en l y stock en ml; rechazo de peso/volumen mezclados | Cantidades normalizadas, errores de incompatibilidad y precisión | `tests/domain.test.js` |
| CP-23 | Inventario JSON | Entrada de 250 g en stock por kg, receta de prueba de 500 g; producción y rechazo de unidad inválida | Stock y movimientos en kg, sin modificaciones ante error | `tests/inventory.test.js` |
| CP-24 | Integración MySQL | Entrada, ficha técnica y producción ficticias expresadas en g con inventario en kg | Consumos consistentes en kg, sin modificar stock cuando una unidad es incompatible | `tests/mysql.test.js` |

La ejecución [v0.4.0 en GitHub Actions](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41968225354) confirma **24 aprobadas, 0 fallidas y 0 omitidas**, incluidas las tres nuevas subpruebas de conversión y MySQL con datos ficticios.
