# Evidencias visuales de Paniko 0.8.3 — instalación local

**Fecha de capturas:** 13 de noviembre de 2026
**Proyecto:** Paniko · Seminario de Integración: Desarrollo
**Equipo:** Paulina Villalpando Guizar, Saúl Mora y Gael Ramírez
**Origen:** capturas realizadas desde \`http://127.0.0.1:3000\` en una computadora local.

## Qué muestran las capturas

Recibimos ocho vistas diferentes de la aplicación en ejecución. Las fotografías completas se integran en el **documento individual de entrega**, sin publicar en este repositorio las imágenes originales ni los detalles de recetas, costos y cantidades de ingredientes.

| Pantalla | Observación visible | Alcance de la evidencia |
| --- | --- | --- |
| Inicio | Panel con 29 ingredientes registrados, 7 fichas técnicas y 3 lotes recientes | Comprueba que se presenta el tablero, no la correcta ejecución de todas las operaciones |
| Inicio / calendario | Calendario de noviembre de 2026 con indicadores de pendientes, planeaciones y días producidos | Prueba visual de calendario; no es una prueba de crear o editar eventos |
| Ingredientes | Formularios de entrada y corrección de existencias | Se ven los controles; no hay evidencia de una entrada **guardada** en esa captura |
| Recetas | Fichas con opciones «Editar ficha», «Ver % panadero» y «Preparar» | Comprueba consulta y navegación; no muestra la operación de guardado |
| Producción | Baguette de masa madre, cálculo de 15 piezas, capacidad visual de 19 piezas e indicador de inventario suficiente | **Vista previa calculada: no se modificó el inventario**. No prueba confirmación de una tanda |
| Mi masa madre | Seguimiento del cultivo, peso disponible de 785 g, ubicación y próxima revisión | Captura de consulta; no valida una nueva alimentación confirmada |
| Productos y ventas | Inventario con 17 productos registrados, 0 piezas terminadas | No se puede afirmar venta registrada desde esta imagen |
| Finanzas | Panel de ingresos, costos, gastos y utilidades; todos en $0.00 | Evidencia de interfaz, no de un ingreso o gasto procesado |

Las capturas representan la **instalación local 0.8.3** indicada en el menú lateral. El repositorio tiene **0.7.2 en \`main\`**; las versiones posteriores todavía están en ramas y Pull Requests. No debemos atribuir esas pantallas a la versión \`main\`.

## Privacidad

Las capturas originales de producción pueden mostrar cantidades de receta y costos estimados. Para el documento se ocultaron esos valores cuando fue necesario. **No publicar** originales, archivos \`.env\`, recetas privadas, respaldos, información financiera real ni claves de acceso.

## Próxima validación de la demo

**Pendiente de ejecutar y registrar:** confirmar una tanda con datos ficticios, comprobar el stock de ingredientes antes y después, mostrar el lote nuevo en Historial y verificar el inventario terminado cuando corresponda.

Esta evidencia visual **no equivale** a que los casos manuales DM-01 a DM-10 hayan sido ejecutados. Las pruebas automáticas de \`main\` tienen su propia [ejecución aprobada en GitHub Actions](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43374837592).

## Estado del PR #19

Saúl (usuario \`saulmora8831-hub\`) dejó [observaciones concretas en la conversación del PR](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870172329) y [un comentario LGTM](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870174609). También se [respondió a su recomendación](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870518057) sobre preparar accesos y pruebas de la demo. Aún no hay una revisión formal \`Approve\` registrada: **un comentario LGTM no es una aprobación oficial del PR**.
