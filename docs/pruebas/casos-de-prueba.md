# Casos de prueba — Paniko v0.1.0

**Fecha de ejecución local:** 4 de noviembre de 2026 (zona horaria de México). **Entorno:** Node.js 22.16.0, `npm test`. **Resultado:** 9 pruebas aprobadas, 0 fallidas.

Los datos son **ficticios**; las pruebas operan sobre funciones de negocio y un archivo temporal en la integración. No hay pruebas de aceptación de Ale Sánchez todavía.

| ID | Tipo | Caso / entradas | Resultado esperado | Estado | Archivo |
| --- | --- | --- | --- | --- | --- |
| CP-01 | Unitario e integración | Ingrediente Harina, kg, costo $25, stock 5 | Registro válido, respuesta 201 | Aprobado | `tests/domain.test.js`, `tests/integration.test.js` |
| CP-02 | Unitario e integración | Ingrediente sin nombre | Error de validación, HTTP 400 | Aprobado | `tests/domain.test.js`, `tests/integration.test.js` |
| CP-03 | Unitario | Ingrediente con costo -$2 | Rechazar costo negativo | Aprobado | `tests/domain.test.js` |
| CP-04 | Unitario e integración | Conchas, 10 piezas, harina y azúcar | Crear ficha ligada a ingredientes existentes, 201 | Aprobado | `tests/domain.test.js`, `tests/integration.test.js` |
| CP-05 | Integración | Consultar recetas luego de crear una | Obtener receta guardada en API | Aprobado | `tests/integration.test.js` |
| CP-06 | Unitario e integración | Escalar receta de 10 a 20 conchas | 2 kg harina, 0.5 kg azúcar, costo $65 | Aprobado | `tests/domain.test.js`, `tests/integration.test.js` |
| CP-07 | Unitario e integración | Escalar con producción 0 | Rechazar, HTTP 400 | Aprobado | `tests/domain.test.js`, `tests/integration.test.js` |
| CP-08 | Unitario | Ficha con ingrediente inexistente | Rechazar y explicar error | Aprobado | `tests/domain.test.js` |
| CP-09 | Unitario e integración | Vista previa de stock | Detectar suficiencia y no modificar existencia | Aprobado | `tests/domain.test.js`, `tests/integration.test.js` |

**Interpretación del conteo:** `npm test` muestra nueve subpruebas; varios casos CP se verifican dentro de la misma subprueba de integración. Esto no significa nueve pruebas de aceptación independientes.

## Dónde comprobar los resultados

- [Bitácora](registro-ejecuciones.md).
- [Salida de terminal](evidencia-ejecucion-2026-11-04.txt).
- [Pruebas unitarias](../../tests/domain.test.js).
- [Prueba de integración](../../tests/integration.test.js).

## Pendiente

1. Ejecutar validaciones de interfaz manuales con capturas en navegador.
2. Evaluar el sistema con Ale Sánchez en una sesión real y documentar aceptación.
3. Migrar a MySQL y agregar pruebas de transacciones de inventario; estas funcionalidades todavía no existen en el MVP.
