# Retrospectiva de medio término — Paniko

**Estado:** borrador de seguimiento de Product Owner basado en evidencias técnicas y comentarios de Ale; **no** representa una reunión retrospectiva realizada o aprobada por todos los integrantes.

## Qué funcionó

El MVP v0.4 resultó útil para Ale durante tres días de uso real, según el comentario recibido. El equipo pudo construir inventario, fichas, escalado y producción, y después evolucionar hacia roles y productos terminados. El repositorio dispone de pruebas automáticas y un workflow con MySQL aislado para revisar cambios antes de fusionarlos.

## Qué obstaculizó el uso

La interfaz que vio Ale agrupaba la información en una sola pantalla y le pareció confusa. Las necesidades de seguimiento financiero por semana no estaban cubiertas. La documentación de la rama de integración aún contiene referencias históricas que deben actualizarse para distinguir entre la versión probada con Ale (v0.4) y la versión técnica reciente (v0.7.1).

## Aprendizajes

La facilidad de uso es tan importante como los cálculos correctos. Mostrar todos los formularios a la vez no es necesariamente útil para quien está trabajando en una panadería. Los nuevos indicadores de negocio deben surgir de operaciones contables definidas y trazables; no se debe asumir que compras equivalen a costo de ventas ni que toda merma equivale a pérdida neta.

## Acciones y backlog ajustado

| Acción | Relación | Estado / verificación |
| --- | --- | --- |
| Separar las tareas en vistas claras y flujo de producción guiado | Hallazgo H-UX-01 | Desarrollado en el rediseño v0.7.0 y conservado en v0.7.1; falta revalidarlo con Ale |
| Resumen financiero semanal para administración | [HU-11 / Issue #10](https://github.com/paulinalizette70-boop/Paniko/issues/10) | Nueva prioridad alta; falta definir métricas e implementarlas |
| Mostrar la diferencia entre ventas, compras, costos, gastos, utilidad y pérdidas | HU-11 | Pendiente de confirmación de definiciones con Ale |
| Conservar las recetas reales fuera de GitHub y restringir las finanzas | Política de privacidad y roles | Implementado en código; verificar permisos en entorno local antes de mezclar PR #9 |
| Revisar la v0.7.1 con la usuaria y registrar aceptación de tareas | [Evaluación v0.4](evaluacion-usuaria-ale-v04.md) | Pendiente |
| Obtener revisión formal de PR y terminar documentación | [PR #9](https://github.com/paulinalizette70-boop/Paniko/pull/9) | Pendiente |

## Alcance demostrable de medio término

La evaluación de tres días se reporta como **retroalimentación cualitativa** de Paniko v0.4. La ejecución de GitHub Actions es **evidencia técnica** de los cambios presentes en la rama. Ni una ni otra sustituyen la validación manual de la v0.7.1 con la base de datos local y la revisión del código por otro integrante.

## Para formalizar la retrospectiva en equipo

Registrar fecha, asistentes, contribuciones, responsables y acuerdos después de celebrar la reunión. No atribuir tareas ni aprobaciones a compañeros sin su confirmación.
