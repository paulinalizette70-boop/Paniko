# Evidencias de GitHub — Paniko

**Seminario de Integración: Desarrollo · Ingeniería Informática · Universidad de Guadalajara, CU Tlaquepaque**

En este archivo reuní los enlaces más importantes de nuestro proyecto para que sea más fácil revisar qué hemos desarrollado, cómo llevamos el control de los cambios y qué cosas todavía tenemos pendientes.

## 1. Repositorio y presentación del proyecto

Nuestro repositorio es **[Paniko](https://github.com/paulinalizette70-boop/Paniko)**.

En el [README](https://github.com/paulinalizette70-boop/Paniko/blob/main/README.md) explicamos para qué sirve, cómo está organizado, qué tecnologías utilizamos, cómo se instala y cómo vamos avanzando.

Actualmente la versión **0.7.2** está integrada en la rama **`main`**. El proyecto sigue en desarrollo; no estamos presentándolo como un sistema terminado para uso público.

## 2. Pruebas que tenemos

Guardamos pruebas en la carpeta [`tests/`](https://github.com/paulinalizette70-boop/Paniko/tree/main/tests). Revisan, entre otras cosas, el inventario, las recetas, las conversiones de unidades, los productos, el inicio de sesión y varias operaciones con MySQL.

| Evidencia | Enlace |
| --- | --- |
| Casos de prueba documentados | [Casos de prueba](pruebas/casos-de-prueba.md) |
| Historial de resultados | [Registro de ejecuciones](pruebas/registro-ejecuciones.md) |
| Pruebas unitarias de ingredientes y fichas | [`tests/domain.test.js`](../tests/domain.test.js) |
| Conversión de agua y huevo | [`tests/unit-conversions-egg-water.test.js`](../tests/unit-conversions-egg-water.test.js) |
| Porcentaje panadero | [`tests/bakers-percent.test.js`](../tests/bakers-percent.test.js) |
| Pruebas con MySQL | [`tests/mysql.test.js`](../tests/mysql.test.js) |
| Workflow que ejecuta las pruebas | [GitHub Actions](../.github/workflows/tests.yml) |
| Ejecución aprobada después de integrar 0.7.2 | [Resultado de GitHub Actions](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43368734526) |

Estas pruebas se ejecutan con **datos ficticios** y una base MySQL de prueba. No significa que hayamos probado o aprobado todas las operaciones con los datos reales de la panadería.

## 3. Prueba con Ale

Del **4 al 7 de noviembre de 2026** le compartí a **Ale Sánchez** la versión **0.4** de Paniko. La utilizó durante tres días dentro de ese periodo.

En general me comentó que el sistema sí le ayudó, pero nos señaló tres cosas importantes: la información estaba muy amontonada en una sola pantalla, tuvo problemas con las unidades g/kg **al crear fichas técnicas** y quería consultar sus ventas, ganancias, inversiones y pérdidas por semana.

De esta experiencia salieron mejoras del diseño y nuevas tareas. No sería correcto decir que Ale aprobó la versión 0.7.2, porque la que probó fue la 0.4.

- [Documento con sus comentarios](seguimiento/evaluacion-usuaria-ale-v04.md)
- [Lo que aprendimos](seguimiento/retrospectiva-medio-termino.md)
- [Problema de g/kg — Issue #11](https://github.com/paulinalizette70-boop/Paniko/issues/11)
- [Resumen semanal solicitado — Issue #10](https://github.com/paulinalizette70-boop/Paniko/issues/10)

También registramos por separado un error local de la versión 0.7.1 con **agua en gramos y litros** ([Issue #12](https://github.com/paulinalizette70-boop/Paniko/issues/12)).

## 4. Issues, bloqueos y cosas pendientes

Los Issues nos sirven para no perder de vista los errores, las mejoras y los asuntos que todavía debemos revisar.

- [Todos los Issues de Paniko](https://github.com/paulinalizette70-boop/Paniko/issues)
- [Registro de bloqueos](seguimiento/bloqueos.md)
- [Deuda técnica](seguimiento/deuda-tecnica.md)

Varias incidencias antiguas describen el estado que tenía el proyecto en ese momento. Algunas funciones ya se programaron en versiones posteriores, pero **todavía debemos comprobarlas y actualizar su estado antes de cerrarlas**.

## 5. Decisiones de arquitectura (ADR)

También documentamos por qué tomamos algunas decisiones técnicas. Por ejemplo, elegimos hacer una aplicación web, usar MySQL, conservar las recetas reales fuera del repositorio y permitir conversiones de unidades.

Están en la carpeta [`docs/adr/`](adr/). Actualmente tenemos seis documentos (ADR-001 a ADR-006).

## 6. Ramas, Pull Requests y contribuciones

La mayor integración quedó en el [**Pull Request #9**](https://github.com/paulinalizette70-boop/Paniko/pull/9), que ya se fusionó con `main` y contiene **Paniko 0.7.2**.

Los PRs [#7](https://github.com/paulinalizette70-boop/Paniko/pull/7) y [#8](https://github.com/paulinalizette70-boop/Paniko/pull/8) son trabajos anteriores que todavía necesitamos revisar para decidir si se cierran como superados.

**Actualización del PR #19:** [Saúl dejó observaciones sobre el guion y las pruebas](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870172329), después [escribió LGTM](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870174609), y [respondimos con los preparativos pendientes](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870518057). Estos son comentarios reales del equipo, pero **todavía no hay una aprobación formal registrada en la pestaña de reviews**. El PR #9 integrado tampoco tuvo esa aprobación. Falta pedir una revisión formal después de los cambios recientes.

También falta organizar por integrante los commits, tareas y evidencias correspondientes. La participación no debe inventarse; debe revisarse con el trabajo que realmente hizo cada quien.

### Evidencia de revisión de los dos compañeros

Ya recibimos comentarios **reales y verificables** de los dos integrantes:

- **Saúl Mora** revisó la organización de la demo y los casos del [PR #19](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870172329), dejó un LGTM en la conversación y [respondimos su sugerencia](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870518057).
- **Gael Ramírez** escribió una [observación técnica en el PR #18](https://github.com/paulinalizette70-boop/Paniko/pull/18#issuecomment-6870981604), relacionada con conversión de leche líquida y ajuste del peso de masa madre. El PR #18 permanece en **Draft** mientras se valida el comportamiento en Windows.

Las evidencias se explican con más detalle en el [registro de comentarios y PRs de medio término](pruebas/evidencia-prs-medio-termino.md). Hasta esta verificación, **no hay aprobaciones formales registradas** en #18 ni #19. No debemos confundir comentarios de la conversación con la opción `Review changes → Approve`.

## 7. Capturas del programa

En el [README](../README.md#capturas-de-paniko) agregamos capturas de Inicio e Historial con información sensible oculta. No publicamos fotos que muestren las fórmulas reales ni las cifras privadas de la panadería.

## 8. Lo que queremos completar

Antes de cerrar la entrega queremos revisar las conversiones al crear fichas en nuestra instalación, añadir la revisión formal de GitHub y terminar la evidencia individual. Después seguiremos con el resumen financiero semanal que nos pidió Ale.

**Estado actual:** `main` contiene **Paniko 0.7.2**; la aplicación y sus pruebas están publicadas, pero todavía hay trabajo por validar y documentar.


## 9. Guía de demo de medio término

Preparamos un [guion de Sprint Review](demo-medio-termino.md) para mostrar el recorrido del inventario, las fichas, el escalado, la producción y el historial, además de los comentarios de Ale. También dejamos un [plan de casos manuales DM-01 a DM-10](pruebas/plan-pruebas-demo.md).

Estos archivos son una **guía y un plan de verificación**. Las pruebas manuales todavía deben ejecutarse y documentarse; no estamos diciendo que todas salieron bien sin haberlas realizado. La ejecución automatizada de `main` ya tiene [evidencia de éxito](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43374837592).


## 10. Capturas de la versión local 0.8.3

Ya documentamos las [pantallas reales de la instalación local y lo que prueban](evidencias/capturas-local-083-2026-11-13.md). Las capturas completas están en el documento individual de la entrega; **no se publicaron originales con datos de recetas o costos**.

- La pantalla de Producción muestra una **vista previa de 15 piezas**, no una producción confirmada.
- El inventario de terminados registra **0 piezas**, así que no se afirma haber completado una venta.
- La instalación local muestra **0.8.3**; la rama `main` continúa en **0.7.2**.
- Queda pendiente ejecutar la tanda de prueba, verificar existencias e incorporar la evidencia de Historial.
