# Revisión final de la rúbrica — Entrega individual de Paniko

**Materia:** Seminario de Integración: Desarrollo · Ingeniería Informática  
**Alumna:** Paulina Lizette Villalpando Guizar  
**Equipo:** Saúl Mora, Gael Ramírez y Paulina Villalpando Guizar  
**Fecha:** noviembre de 2026

Revisamos los criterios solicitados por la maestra y preparamos un **PDF individual de 16 páginas** con el mismo estilo visual que Paniko (verde oliva, fondo crema y capturas de la aplicación). El PDF de entrega **no se sube a GitHub** porque contiene capturas de una instalación local; se entrega directamente a la maestra.

| Criterio de la rúbrica | Evidencia que sí existe | Qué todavía debemos validar |
| --- | --- | --- |
| Demo funcional (Sprint Review) | [Guion del equipo](demo-medio-termino.md) y [descripción de ocho pantallas de Paniko local 0.8.3](evidencias/capturas-local-083-2026-11-13.md). Capturas incluidas en el PDF individual | Confirmar una producción en una base ficticia aislada, demostrar descuentos e Historial, guardar resultado manual |
| README profesional | [README actualizado](../README.md) con instalación, uso, capturas, contribución, privacidad y licencia | Acordar licencia de distribución si la rúbrica exige una licencia seleccionada; actualmente es `UNLICENSED` |
| Pull Requests con comentarios | [PR #9 fusionado](https://github.com/paulinalizette70-boop/Paniko/pull/9); [comentario de Saúl en PR #19](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870172329), [respuesta de Paulina](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870518057); [comentario de Gael en PR #18](https://github.com/paulinalizette70-boop/Paniko/pull/18#issuecomment-6870981604). [Evidencia completa](pruebas/evidencia-prs-medio-termino.md) | No se registró evento `Approve` formal en #18 ni #19; ambos continúan abiertos, #18 es Draft |
| Casos de prueba diseñados y ejecutados | [Pruebas automatizadas de main aprobadas](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43374837592), [GitHub Actions de PR #19 aprobada](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43558587529), [casos documentados](pruebas/casos-de-prueba.md), [bitácora](pruebas/registro-ejecuciones.md) | Diez casos **manuales** [DM-01 a DM-10](pruebas/plan-pruebas-demo.md) todavía sin bitácora de ejecución |
| ADR, bloqueos y deuda técnica | [Seis ADRs](adr/), [bloqueos históricos](seguimiento/bloqueos.md), [deuda técnica actualizada](seguimiento/deuda-tecnica.md) | Verificar estados de algunos ADR históricos; no atribuir a versión actual decisiones que eran provisionales |
| Ajuste al backlog y retrospectiva | [Issues #10, #11 y #12](https://github.com/paulinalizette70-boop/Paniko/issues), [evaluación de Ale con 0.4](seguimiento/evaluacion-usuaria-ale-v04.md) y [retrospectiva](seguimiento/retrospectiva-medio-termino.md) | Confirmar acuerdos con el equipo y volver a mostrar a Ale una versión posterior |
| Comunicación y participación | [Guion con intervenciones propuestas de los tres](demo-medio-termino.md), [comentarios de Saúl y Gael](pruebas/evidencia-prs-medio-termino.md) | Confirmar el reparto y ensayar la presentación |
| Entrega individual | PDF por Paulina, con portada, descripción personal, aportaciones, reflexión y enlaces verificables | La calificación individual corresponde a la maestra |

## Precisión sobre versiones y privacidad

- **`main` = 0.7.2**; los PRs de código posteriores no deben tratarse como fusionados.
- Las capturas corresponden a una **instalación local 0.8.3**, no al código de `main`.
- La vista de Producción dice que **la vista previa no modificó el inventario**.
- No publicamos las capturas originales que muestran detalles de recetas, cantidades, costos, contraseñas o datos operativos.
- La prueba con Ale ocurrió en **Paniko 0.4**, no fue una aceptación de 0.7.2 ni 0.8.3.

Con este documento queda **cubierta la estructura y documentación de todos los criterios**. La ejecución de la demo, los casos manuales y las aprobaciones formales son actividades que no se pueden sustituir por un informe escrito ni por las capturas. 
