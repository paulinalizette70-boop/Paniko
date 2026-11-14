# Entrega de medio término — Equipo Paniko

**Materia:** Seminario de Integración: Desarrollo · Ingeniería Informática · CU Tlaquepaque  
**Integrantes:** Paulina Villalpando Guizar, Saúl Mora y Gael Ramírez  
**Entrega:** un informe del equipo y un recorrido funcional de la aplicación

## Estado de los entregables

| Rúbrica | Evidencia comprobable | Lo que queda por hacer |
| --- | --- | --- |
| **Demo funcional / Sprint Review** | [Guion del equipo](demo-medio-termino.md) y [descripción de ocho pantallas de la instalación local 0.8.3](evidencias/capturas-local-083-2026-11-13.md) | Confirmar una tanda **con datos ficticios y MySQL de demo** y mostrar su historial |
| **README profesional** | [README](../README.md): objetivo, instalación, uso, capturas, contribución, privacidad y estado de licencia | La licencia sigue como **UNLICENSED** hasta acuerdo del equipo |
| **Pull Requests** | [PR #9](https://github.com/paulinalizette70-boop/Paniko/pull/9) fusionado; [comentario de Saúl en #19](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870172329) y [Gael en #18](https://github.com/paulinalizette70-boop/Paniko/pull/18#issuecomment-6870981604); [registro de PRs](pruebas/evidencia-prs-medio-termino.md) | Obtener la revisión formal de los cambios actuales (Approve), cuando los compañeros estén de acuerdo |
| **Pruebas diseñadas y ejecutadas** | [Tests automáticos de main aprobados](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43374837592), [casos documentados](pruebas/casos-de-prueba.md) y [bitácora histórica](pruebas/registro-ejecuciones.md) | Ejecutar las [10 pruebas manuales DM-01–DM-10](pruebas/plan-pruebas-demo.md) y guardar sus resultados reales |
| **ADRs, bloqueos y DT** | [Seis ADRs](adr/), [bloqueos](seguimiento/bloqueos.md) y [deuda técnica](seguimiento/deuda-tecnica.md) | Revisar estados históricos y prioridades después de los ensayos |
| **Backlog y retrospectiva** | [Retroalimentación de Ale sobre 0.4](seguimiento/evaluacion-usuaria-ale-v04.md), [retrospectiva](seguimiento/retrospectiva-medio-termino.md) e [Issues](https://github.com/paulinalizette70-boop/Paniko/issues) | Confirmar los acuerdos del equipo; retroalimentación de Ale no valida 0.8.3 |
| **Comunicación** | [Propuesta de exposición de los tres](demo-medio-termino.md); revisiones de Saúl y Gael en GitHub | Repartir los turnos definitivos y ensayar |

## Guion de exposición sugerido

1. **Paulina:** problema de inventario en la panadería, objetivo de Paniko y retroalimentación de Ale.
2. **Gael:** recorrido por Inicio, Ingredientes, existencias y productos.
3. **Saúl:** ficha técnica, vista previa de escalado y evidencia de GitHub Actions.
4. **Los tres:** explicar lo que se confirmó en la base de demostración, qué falta y preguntas.

Este reparto es una propuesta: **no sustituye la confirmación de cada integrante**.

## Ensayo práctico para registrar resultados

Antes de abrir la app, revisar **a qué base se conecta**: nunca ejecutar movimientos de demo sobre la base de la panadería. Utilizar datos ficticios sin recetas ni costos reales.

- [ ] Entrar a Paniko con una cuenta de prueba.
- [ ] Mostrar una ficha ficticia de 10 piezas y vista previa de 20; comprobar que **todavía no cambia** el inventario.
- [ ] Confirmar una tanda con stock suficiente **solo en MySQL aislado**; comprobar descuento único.
- [ ] Abrir Historial y mostrar el lote y su fecha.
- [ ] Mostrar GitHub Actions, PR #9, PR #18 y PR #19.
- [ ] Registrar fecha, responsable, versión, resultado y capturas **sin datos privados**. Si falla, anotarlo; no marcarlo como aprobado.

## Nota de versión

La rama `main` contiene la versión **0.7.2**; las capturas de la computadora muestran **0.8.3 local**. No debemos afirmar que esa versión local está integrada en `main`. El PR #18 sigue como borrador; el PR #19 contiene esta documentación y está abierto. La CI aprobada **no equivale** a las pruebas manuales.

## Entrega

El informe del equipo es un **PDF de 17 páginas**, con estética inspirada en Paniko, capturas locales con detalles privados ocultos y una hoja final de ensayo. El PDF se entrega a la maestra directamente y **no se publica en el repositorio**, para proteger los datos de la instalación local.

**Registro académico:** el equipo dispone de evidencia escrita para cada criterio; la demostración funcional y aprobación formal deben efectuarse realmente para cumplir por completo esos componentes.
