# Evaluación formativa con usuaria — Paniko v0.4

**Proyecto:** Paniko, sistema de gestión de panadería artesanal  
**Usuaria:** Ale Sánchez, responsable de la panadería y stakeholder  
**Versión probada:** Paniko v0.4 (NO v0.7.1)  
**Periodo de prueba:** del 4 al 7 de noviembre de 2026  
**Uso reportado:** tres días durante ese periodo (no necesariamente todos los días calendario)  
**Tipo de evidencia:** relato cualitativo de la usuaria, comunicado por la Product Owner. No existe en este documento un acta firmada, grabación, métricas verificadas ni encuesta cuantitativa.

## Propósito

Conocer si una persona de la panadería encontraba útil y comprensible el sistema durante actividades de trabajo, identificar dificultades y recopilar solicitudes para el backlog.

## Retroalimentación recibida

| Dimensión | Comentario reportado | Lectura para el producto |
| --- | --- | --- |
| Utilidad | El sistema le ayudó bastante durante los tres días que lo utilizó | Señal cualitativa favorable; no permite calcular ahorro de tiempo ni porcentaje de satisfacción |
| Usabilidad | Le pareció confuso porque toda la información estaba en una sola pantalla | La interfaz v0.4 necesitaba separar funciones y aclarar la navegación |
| Unidades de medida | Reportó que el sistema no reconocía como equivalentes cantidades expresadas en gramos (g) y kilogramos (kg) | Verificar conversión g↔kg en inventario, fichas, escalado y producción; revisar la interfaz, no solo los cálculos |
| Necesidad de negocio | Solicitó visualizar por semana cuánto vendió, ganó, invirtió y perdió | Se requiere un resumen financiero semanal, con indicadores definidos y acceso solo de administración |

Estas observaciones son una **síntesis de lo reportado**. No son citas textuales grabadas ni pruebas de todas las funciones.

## Hallazgos y seguimiento

**H-UX-01 — Navegación confusa de v0.4.** Reorganizar las tareas para que la persona operadora identifique rápidamente inventario, recetas, producción, productos/ventas e historial.

- **Respuesta de diseño:** en la rama de integración, Paniko v0.7.0 reorganiza la interfaz por secciones y simplifica el flujo de producción. La versión v0.7.1 conserva ese enfoque.
- **Estado de validación:** la corrección está desarrollada, pero **Ale aún no ha confirmado aquí que la interfaz v0.7.1 sea satisfactoria**.

**H-NEG-01 — Visibilidad financiera semanal.** Crear un apartado de administración con resumen por semana que permita comprender ingresos, compras/inversiones, utilidad y pérdidas.

- **Respuesta de producto:** [HU-11 / Issue #10](https://github.com/paulinalizette70-boop/Paniko/issues/10).
- **Estado:** pendiente de implementación y de precisar con Ale la definición de los indicadores; no atribuir estos cálculos al módulo existente de costos.

**H-FUN-01 — Equivalencia de unidades g↔kg.** Ale comunicó dificultades para usar un ingrediente expresado en gramos y kilogramos como cantidades de la misma magnitud durante el uso de v0.4.

- **Referencia:** [Incidencia #11 — equivalencia g↔kg](https://github.com/paulinalizette70-boop/Paniko/issues/11); relacionada también con el [Issue #3](https://github.com/paulinalizette70-boop/Paniko/issues/3).
- **Estado técnico:** el código actual contiene `convertQuantity` y pruebas automatizadas de g↔kg. **No está demostrado** que el flujo exacto con el que tuvo problemas funcione correctamente en v0.7.1. Se necesitan pruebas de extremo a extremo con datos ficticios y revalidación.
- **Precisión:** no se han recibido los pasos exactos, la operación o el mensaje de error; no atribuir este fallo a una pantalla concreta sin reproducirlo.

## Límites de esta evidencia

Esta fue una evaluación exploratoria de **v0.4**, no una aceptación formal del MVP actual. Se conoce el periodo del 4 al 7 de noviembre de 2026, pero no se documentan los días específicos de uso, participantes adicionales, número de operaciones, tasas de éxito ni importes reales porque no se suministraron esos datos. No es correcto decir que Ale probó o aprobó la v0.7.1 basándonos en estos comentarios.

## Próxima validación sugerida

En una próxima sesión con Ale, usar datos de prueba y pedirle que localice una receta, escale una preparación, consulte existencias y registre una venta; observar si encuentra rápidamente las secciones en v0.7.1. Registrar tareas, resultados y observaciones sin publicar fórmulas reales ni información financiera sensible.

**Trazabilidad:** [Incidencia de conversión #11](https://github.com/paulinalizette70-boop/Paniko/issues/11); [PR #9](https://github.com/paulinalizette70-boop/Paniko/pull/9) (rediseño y mejoras); [HU-11](https://github.com/paulinalizette70-boop/Paniko/issues/10) (resumen financiero semanal); [retrospectiva](retrospectiva-medio-termino.md).
