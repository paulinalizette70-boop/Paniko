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

**Pendiente:** guardar la revisión formal del código por otro integrante. Aunque ya integramos el PR #9, no contamos con esa aprobación en GitHub, así que no la marcamos como realizada.

También falta organizar por integrante los commits, tareas y evidencias correspondientes. La participación no debe inventarse; debe revisarse con el trabajo que realmente hizo cada quien.

## 7. Capturas del programa

En el [README](../README.md#capturas-de-paniko) agregamos capturas de Inicio e Historial con información sensible oculta. No publicamos fotos que muestren las fórmulas reales ni las cifras privadas de la panadería.

## 8. Lo que queremos completar

Antes de cerrar la entrega queremos revisar las conversiones al crear fichas en nuestra instalación, añadir la revisión formal de GitHub y terminar la evidencia individual. Después seguiremos con el resumen financiero semanal que nos pidió Ale.

**Estado actual:** `main` contiene **Paniko 0.7.2**; la aplicación y sus pruebas están publicadas, pero todavía hay trabajo por validar y documentar.
