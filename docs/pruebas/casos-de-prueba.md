# Casos de prueba — Paniko

**Estado al 4 de noviembre de 2026: diseñados; sin ejecución comprobada.** Los datos son ficticios y se deben adaptar a los campos reales de la aplicación.

| ID | Módulo | Tipo | Descripción | Datos de prueba | Resultado esperado | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CP-01 | Ingredientes | Aceptación | Registrar ingrediente válido | Harina de trigo, kg, $25 por kg | Se guarda y aparece en el listado | No ejecutado |
| CP-02 | Ingredientes | Aceptación | Validación de nombre vacío | Nombre vacío, kg, $25 por kg | Rechaza el registro e informa el error | No ejecutado |
| CP-03 | Ingredientes | Aceptación | Validación de costo negativo | Azúcar, kg, -$10 por kg | Rechaza un costo inválido | No ejecutado |
| CP-04 | Fichas técnicas | Aceptación | Crear una receta | Conchas de prueba, 10 piezas; harina 1 kg, azúcar 250 g | Se guarda con ingredientes y unidades correctas | No ejecutado |
| CP-05 | Fichas técnicas | Aceptación | Consultar ficha existente | Buscar 'Conchas de prueba' | Recupera las cantidades registradas | No ejecutado |
| CP-06 | Escalado | Aceptación futura | Escalar producción | Receta para 10 piezas; solicitar 20 | Multiplica cantidades por 2 | No ejecutado: en desarrollo |
| CP-07 | Escalado | Aceptación futura | Producción inválida | Solicitar 0 piezas | No permite producción de cantidad cero | No ejecutado: en desarrollo |

## Procedimiento para ejecutar cada caso
1. Abrir una versión identificable de la aplicación y preparar los datos.
2. Registrar responsable, fecha, entorno y estado inicial.
3. Realizar la acción detallada en el caso y observar la respuesta.
4. Comparar el resultado observado con el esperado.
5. Registrar aprobado, fallido, bloqueado o no ejecutado en la [bitácora](registro-ejecuciones.md).
6. Adjuntar enlace a captura, video, salida de consola o prueba automatizada, y registrar Issue si corresponde.

> Para la entrega de **tests realizados** todavía falta ejecutar estos casos en el software real. No se atribuyen éxitos sin evidencia.
