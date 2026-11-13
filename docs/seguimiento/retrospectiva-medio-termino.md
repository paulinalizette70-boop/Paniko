# Lo que aprendimos en esta etapa de Paniko

Este documento reúne lo que llevamos del proyecto, los problemas que encontramos y lo que queremos hacer después. Lo estamos usando como **borrador de retrospectiva**; todavía no es un acta de una reunión formal aprobada por todo el equipo.

## Lo que nos ha funcionado

Al inicio nos enfocamos en poder registrar ingredientes, crear fichas técnicas y calcular la cantidad necesaria para producir diferentes piezas de pan. Después agregamos MySQL, movimientos de inventario, usuarios, productos terminados, ventas e historial.

También empezamos a utilizar pruebas automatizadas y GitHub Actions. Esto nos permite revisar que varias funciones sigan trabajando después de realizar cambios en el código.

Una de las cosas más útiles fue compartir la **versión 0.4 con Ale**. La probó durante tres días del **4 al 7 de noviembre de 2026** y me comentó que le había servido, aunque tenía varias observaciones.

## Lo que se nos complicó

La primera versión que le mostramos a Ale concentraba demasiada información en una sola pantalla. Ella nos dijo que era confuso encontrar lo que necesitaba.

También encontró problemas **al crear fichas técnicas**, porque no reconocía correctamente ingredientes registrados en gramos y utilizados en kilogramos, o viceversa. Más adelante, en la versión local 0.7.1, apareció otro error al intentar utilizar agua guardada en litros en una receta expresada en gramos.

Otra cosa que nos hizo notar es que a la panadería le serviría consultar sus resultados por semana: **ventas, ganancias, inversión y pérdidas**. Esa información todavía no está reunida en un resumen como el que ella necesita.

## Qué decisiones tomamos

| Situación | Qué hicimos | Qué sigue |
| --- | --- | --- |
| Las pantallas eran confusas. | Reorganizamos la interfaz por apartados en la versión 0.7.0 y posteriores. | Volver a mostrársela a Ale. |
| Había problemas con g↔kg al crear fichas. | Agregamos conversiones y pruebas en el código. | Comprobar el flujo completo en la interfaz ([Issue #11](https://github.com/paulinalizette70-boop/Paniko/issues/11)). |
| El agua estaba en litros y la receta en gramos. | En 0.7.2 se incorporó una equivalencia especial para el agua. | Probarla en nuestra instalación ([Issue #12](https://github.com/paulinalizette70-boop/Paniko/issues/12)). |
| Ale quiere conocer sus resultados semanales. | Registramos la necesidad como historia de usuario. | Definir los cálculos e implementarla ([HU-11](https://github.com/paulinalizette70-boop/Paniko/issues/10)). |
| Necesitábamos registrar mejor los avances. | Organizamos pruebas, ADRs, Issues y cambios por ramas. | Completar la evidencia individual y revisar los PRs que siguen abiertos. |

## Lo que me dejó esta etapa

Me quedó más claro que **un programa puede hacer los cálculos bien y aun así ser difícil de usar**. Por eso queremos probar las funciones desde las pantallas, no solamente con pruebas de código.

También aprendimos que las reglas de la panadería importan mucho. Por ejemplo, no podemos convertir automáticamente todos los líquidos de gramos a litros como si fueran agua, ni llamar «ganancia» a cualquier diferencia entre ventas y compras.

## Cómo va GitHub

Integramos **Paniko 0.7.2 en la rama `main`** mediante el [PR #9](https://github.com/paulinalizette70-boop/Paniko/pull/9), y las pruebas automáticas de esa integración se aprobaron.

Todavía nos falta conseguir una revisión formal de otro integrante para documentar el trabajo en equipo y revisar los PRs anteriores. No vamos a marcar esas actividades como terminadas sin tener su evidencia.

## Próximos pasos

Queremos comprobar las conversiones dentro de las fichas técnicas, revisar la versión más nueva con Ale, seguir el desarrollo del apartado financiero semanal y terminar las evidencias de GitHub.

**Importante:** estos son nuestros aprendizajes y acciones de seguimiento. La prueba con Ale fue de la **versión 0.4** y no significa que haya aprobado la versión 0.7.2. Las tareas y responsabilidades definitivas se registrarán cuando las confirme el equipo.

[Ver informe de la prueba con Ale](evaluacion-usuaria-ale-v04.md) · [Ver entrega de GitHub](../entrega-github.md)
