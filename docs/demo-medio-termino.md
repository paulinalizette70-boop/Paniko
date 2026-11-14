# Demo de medio término y evidencias — Paniko

**Materia:** Seminario de Integración: Desarrollo  
**Equipo:** Paulina Lizette Villalpando Guizar, Saúl Emiliano Mora Famoso y Gael Iosef Ramírez Marmolejo  
**Fecha de preparación:** 13 de noviembre de 2026

Este documento es nuestra guía para presentar lo que llevamos de Paniko. La idea es que la maestra pueda ver **el programa funcionando**, las pruebas que tenemos y lo que aprendimos al compartir una versión con Ale.

> **Versión que sí está en `main`: 0.7.2.** Las versiones posteriores 0.7.3 a 0.8.3 están en ramas con PRs de desarrollo y no deben presentarse como funcionalidades ya integradas a `main`. Si usamos una versión local posterior, primero hay que verificarla y dejar claro cuál se está mostrando.

## Evidencia visual local incorporada (13 de noviembre)

Ya contamos con **capturas reales de la instalación local 0.8.3**, incluidas en el documento individual editable de la entrega. Muestran Inicio (29 ingredientes, 7 fichas y 3 lotes), calendario, formularios de inventario, fichas técnicas, vista previa de 15 baguettes, seguimiento de masa madre, productos (17 registros, 0 piezas) y Finanzas (importes en $0.00).

La vista previa informa expresamente «No se modificó el inventario»: **todavía no tenemos en esas capturas evidencia de una tanda nueva confirmada, de su historial o de una venta ejecutada**. La instalación local 0.8.3 tampoco equivale a la versión 0.7.2 que está integrada en `main`.

[Consultar el inventario y alcance de las capturas](evidencias/capturas-local-083-2026-11-13.md). Las originales no se suben aquí para evitar compartir cantidades y costos privados.

### Comentarios de revisión de Saúl

Saúl Mora (`saulmora8831-hub`) publicó una [revisión escrita en la conversación](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870172329) y un [LGTM](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870174609). Respondimos [su recomendación de preparar los accesos y las pruebas manuales](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870518057). **La aprobación formal de GitHub aún no está registrada; falta `Review changes → Approve` y revisar los cambios nuevos antes de integrar**.

## Qué vamos a demostrar

Nuestra prioridad ha sido conectar **ingredientes → fichas técnicas → cálculo de producción → descuento de inventario → historial**.

Para que la demo no tenga problemas, utilizaremos **una base MySQL de demostración separada de la real** y recetas ficticias. No vamos a mostrar costos confidenciales, contraseñas ni cantidades de recetas de la panadería.

### Guion sugerido para la Sprint Review (8–10 minutos)

| Momento | Persona que podría presentarlo | Qué mostramos / qué decimos |
| --- | --- | --- |
| 0:00–1:00 | **Paulina** | Qué es Paniko, para quién lo hacemos y cuál es el problema del inventario que queremos resolver |
| 1:00–2:00 | **Gael** | Inicio de sesión, nueva navegación, pantalla de Ingredientes y cómo consultar existencias |
| 2:00–4:30 | **Saúl** | Ficha técnica ficticia, escalado de 10 a 20 piezas, vista previa y verificación del inventario |
| 4:30–6:00 | **Gael** | Confirmación de una producción **solo en base de pruebas**, historial del lote y productos/ventas si el flujo se preparó con datos ficticios |
| 6:00–7:00 | **Saúl** | Casos de prueba, código de conversión y ejecución aprobada de GitHub Actions |
| 7:00–8:30 | **Paulina** | Qué opinó Ale de la versión 0.4, cómo cambiamos las pantallas y qué agregamos al backlog |
| 8:30–10:00 | **Equipo** | Qué falta, decisiones ADR, problemas y deuda técnica; preguntas de la maestra |

**Este reparto es una propuesta para que todos participemos; se confirma con Saúl y Gael antes de exponer.** No significa que esas personas hayan programado todas las partes que presentan.

### Demostración con datos ficticios

1. Entrar con una cuenta de **demostración** y mostrar la pantalla Inicio.
2. Abrir **Ingredientes** y señalar las existencias; no trabajar con las existencias reales de la panadería.
3. Abrir **Recetas** y mostrar una ficha técnica de prueba. Si queremos crearlas desde cero, registrar primero insumos ficticios en una base aislada.
4. Seleccionar una receta de **10 piezas** y cambiar la vista previa a **20 piezas**. Explicar que Paniko calcula las cantidades y revisa si alcanzan los insumos.
5. **Solo en la base de demo**, confirmar una producción si la vista previa indica inventario suficiente.
6. Ir a **Historial** y abrir la tanda creada para mostrar la trazabilidad.
7. Mostrar **Productos y ventas** sin intentar vender piezas que no existan; si preparamos un producto ficticio con stock, registrar una venta de demostración.
8. Terminar mostrando **GitHub Actions** y el README, sin abrir archivos locales con contraseñas o recetas privadas.

**Plan de respaldo:** si falla una operación en vivo, mostrar las capturas del README, explicar el caso que está registrado en Issues y continuar con las pruebas automatizadas; no presentar una imagen como una ejecución exitosa en vivo.

## Preparación segura de la demo

La opción más segura es una instalación de Paniko conectada a una base MySQL exclusiva de pruebas. No es suficiente crear una carpeta nueva si esa carpeta conserva el `.env` de la panadería.

- Comprobar que el nombre de la base corresponde al entorno de demostración y que **no contiene datos reales**.
- Hacer respaldo si se utilizará una instalación que ya tenga registros.
- Usar nombres ficticios, por ejemplo «Harina de prueba», «Azúcar de prueba» y «Conchas de demostración».
- En `main` existe `scripts/seed-demo.js` para cargar ejemplos **solo con autorización explícita y cuando no haya registros**. No ejecutarlo contra la base de la panadería.
- Abrir Paniko, comprobar credenciales y recorrer la demo completa antes de la presentación.
- Guardar capturas del resultado de cada prueba manual, ocultando cualquier información sensible.

[Ver plan de casos para la demo](pruebas/plan-pruebas-demo.md).

## Evidencias de los criterios de evaluación

| Criterio | Qué tenemos | Qué falta antes de decir «terminado» |
| --- | --- | --- |
| **Demo funcional** | Código 0.7.2 en `main` y [capturas locales de 0.8.3](evidencias/capturas-local-083-2026-11-13.md) (incluidas en el documento individual) | Confirmar una tanda ficticia y registrar historial y cambios de inventario; las capturas actuales son de consulta/vista previa |
| **README profesional** | [README](../README.md) con objetivo, instalación, uso, capturas, colaboración y apartado de licencia | Elegir una licencia solo si el equipo decide otorgarla; ahora está `UNLICENSED` |
| **Casos de prueba** | [Pruebas automáticas](../tests/), [catálogo histórico](pruebas/casos-de-prueba.md), [ejecución aprobada de `main`](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43374837592) | Ejecutar y anotar los casos manuales del [plan de demo](pruebas/plan-pruebas-demo.md) |
| **Pull Requests** | [PR #9](https://github.com/paulinalizette70-boop/Paniko/pull/9) fusionado; [comentarios reales de Saúl en PR #19](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870172329) y respuesta | Falta aprobación formal de otro integrante mediante `Review changes → Approve` |
| **ADR, bloqueos y deuda técnica** | Seis [ADRs](adr/), [bloqueos](seguimiento/bloqueos.md) y [deuda técnica](seguimiento/deuda-tecnica.md) | Revisar que los estados correspondan a `main`, no a versiones anteriores |
| **Backlog y retrospectiva** | [Issues](https://github.com/paulinalizette70-boop/Paniko/issues), [comentarios de Ale](seguimiento/evaluacion-usuaria-ale-v04.md) y [retrospectiva](seguimiento/retrospectiva-medio-termino.md) | Revisar prioridades y confirmar acuerdos reales con el equipo |
| **Comunicación** | Podemos explicar el problema, la solución y los pendientes | Confirmar participación de todos y ensayar las transiciones de la presentación |

## Qué aprendimos de la prueba con Ale

Del **4 al 7 de noviembre de 2026** compartí con Ale la **versión 0.4** para que la utilizara durante tres días. Nos comentó que le resultaba útil, pero señaló que la pantalla era confusa, que fallaban las equivalencias entre gramos y kilogramos al **crear fichas técnicas** y que necesitaba revisar ventas, ganancias, inversión y pérdidas por semana.

A partir de esto reorganizamos la interfaz y registramos nuevos pendientes. **La evaluación no fue una aceptación de 0.7.2 ni de las versiones posteriores.**

- [Evaluación de Ale](seguimiento/evaluacion-usuaria-ale-v04.md).
- [Conversión g/kg en fichas — Issue #11](https://github.com/paulinalizette70-boop/Paniko/issues/11).
- [Error local de Agua en g/l de la 0.7.1 — Issue #12](https://github.com/paulinalizette70-boop/Paniko/issues/12).
- [Resumen financiero semanal — HU-11 / Issue #10](https://github.com/paulinalizette70-boop/Paniko/issues/10).

## Qué decir sobre los PRs

Ya usamos ramas y PRs para integrar cambios. Por ejemplo, el PR #9 dejó publicada la versión 0.7.2 en `main`, con una ejecución de pruebas aprobada. **Ese PR no tuvo una revisión formal registrada de otro integrante antes de fusionarse**, así que no podemos presentarla como evidencia.

Para esta entrega queremos que un integrante distinto del autor revise el PR de documentación de medio término: que abra **Files changed**, deje un comentario concreto, proponga una mejora y marque su revisión. Después debemos responder y dejar documentado si se aprobó o se solicitaron cambios. Un comentario de la misma persona que creó el PR no cuenta como revisión colegiada.

Los PRs de versiones 0.7.3–0.8.3 están encadenados como borradores. No debemos fusionarlos todos de golpe para la demo sin verificar dependencias, integración y datos.

## Qué falta para cerrar

- [ ] Confirmar qué versión local mostraremos y que funcione con **base de datos ficticia**.
- [ ] Ejecutar los casos manuales y guardar fecha, resultado y evidencia.
- [ ] Pedir una revisión real del PR de documentación y atender los comentarios.
- [ ] Confirmar el reparto de participación con Saúl y Gael.
- [ ] Marcar en el backlog los acuerdos y pendientes reales.
- [ ] Entregar la parte individual con enlaces y actividades que cada quien pueda demostrar.

**Recomendación para la maestra:** mostrar primero el funcionamiento y después abrir los enlaces de GitHub para respaldar lo presentado. Es más claro que recorrer carpetas sin explicar para qué sirven.
