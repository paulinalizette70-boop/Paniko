# Prueba de Paniko con Ale — versión 0.4

**Periodo:** del 4 al 7 de noviembre de 2026  
**Tiempo de uso:** tres días dentro de ese periodo  
**Persona que lo probó:** Ale Sánchez, responsable de la panadería  
**Versión que le compartí:** Paniko 0.4

## ¿Cómo fue la prueba?

Le compartí a Ale una versión de Paniko para que pudiera utilizarla durante sus actividades en la panadería. Quería saber si realmente le resultaba útil y qué cosas debíamos mejorar, porque una cosa es que el programa funcione en nuestras pruebas y otra que sea sencillo para alguien que lo va a usar en su trabajo.

Ale lo utilizó durante tres días, entre el 4 y el 7 de noviembre de 2026. En general me comentó que **sí le ayudó bastante**, pero también encontró cosas que se le dificultaron y nos hizo algunas sugerencias.

Esta fue una **prueba de uso con comentarios de una usuaria real**. No hicimos una encuesta con puntuaciones ni medimos tiempos, así que no voy a presentar porcentajes de satisfacción o resultados que no registramos.

## ¿Qué nos comentó?

| Lo que observó Ale | Lo que entendimos que teníamos que mejorar |
| --- | --- |
| Le resultaba confuso que casi toda la información estuviera en una sola pantalla. | Separar las funciones y hacer que sea más fácil encontrar cada apartado. |
| Al **crear fichas técnicas**, tuvo problemas al utilizar un ingrediente en gramos cuando estaba registrado en kilogramos, o al revés. | Revisar que la creación de fichas reconozca las unidades equivalentes y no obligue a duplicar ingredientes. |
| Quería saber cuánto vendió, ganó, invirtió y perdió durante la semana. | Agregar más adelante un resumen financiero semanal que pueda consultar la administradora. |
| El sistema le ayudó durante los días que lo usó. | Conservar las funciones que sí le sirvieron y seguir mejorando la experiencia de uso. |

## ¿Qué hicimos con sus comentarios?

### 1. Organizamos mejor las pantallas

En la versión 0.4 la información estaba demasiado concentrada. Después trabajamos en un diseño con secciones como **Inicio, Ingredientes, Recetas, Producción, Productos y ventas, Historial y Finanzas**.

La idea es que una persona no tenga que revisar toda la información de golpe para encontrar lo que necesita. **Todavía falta enseñarle la versión más reciente a Ale para confirmar si le resulta más clara.**

### 2. Trabajamos en las conversiones

La dificultad que Ale encontró ocurrió específicamente al **crear una ficha técnica**. Por ejemplo, si la harina ya está en el inventario como `kg`, debería poder seleccionarse en una ficha que utiliza `g`.

Las conversiones g↔kg ya están programadas y tienen pruebas, pero todavía queremos comprobar ese recorrido completo desde las pantallas. Lo anotamos en el [Issue #11](https://github.com/paulinalizette70-boop/Paniko/issues/11).

**Otro caso distinto:** al probar localmente la versión 0.7.1, encontramos un error porque el **agua** estaba registrada en litros y una receta la utilizaba en gramos. Lo documentamos en el [Issue #12](https://github.com/paulinalizette70-boop/Paniko/issues/12). La versión 0.7.2 contiene una corrección de código para esa equivalencia, pero aún falta revisarla en nuestra instalación. Este segundo caso no se lo atribuimos a la prueba de Ale.

### 3. Agregamos su sugerencia al backlog

Registramos la idea del **resumen financiero semanal** en la [historia HU-11](https://github.com/paulinalizette70-boop/Paniko/issues/10).

Queremos que Ale pueda revisar las ventas, inversiones, ganancias y pérdidas de la panadería. Antes de mostrar estos números debemos definir bien de dónde saldrán los datos, para no confundir ingresos con ganancias. **Esta función todavía está pendiente.**

## ¿Qué aprendí de esta prueba?

Me ayudó a darme cuenta de que no basta con tener todas las funciones en el sistema. También importa cómo están acomodadas y si una persona puede utilizarlas sin confundirse.

La prueba nos dio razones concretas para rediseñar la interfaz y para darle prioridad a las conversiones de unidades y al apartado financiero.

## Qué falta comprobar

La evaluación se hizo con **Paniko 0.4**, no con 0.7.2. Todavía necesitamos probar la versión nueva en la instalación de la panadería y volver a pedirle su opinión a Ale.

No tenemos documentados los tres días específicos de uso dentro del 4 al 7 de noviembre, las cantidades exactas que capturó al encontrar el problema ni un acta firmada. Por eso dejamos esta evidencia como los comentarios que recibimos, sin inventar resultados.

**Enlaces relacionados:** [retrospectiva](retrospectiva-medio-termino.md) · [Issue #11](https://github.com/paulinalizette70-boop/Paniko/issues/11) · [Issue #12](https://github.com/paulinalizette70-boop/Paniko/issues/12) · [HU-11](https://github.com/paulinalizette70-boop/Paniko/issues/10)
