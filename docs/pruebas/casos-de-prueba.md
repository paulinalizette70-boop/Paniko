# Casos de prueba — Paniko v0.2.0

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
