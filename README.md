# Paniko

**Sistema de trazabilidad y control de producción para panaderías artesanales**

Proyecto de Seminario de Integración: Desarrollo — Universidad de Guadalajara, Centro Universitario de Tlaquepaque.

## Objetivo
Facilitar el registro de insumos, la creación de fichas técnicas de recetas y, progresivamente, el escalado de producción, la comprobación de inventario, el cálculo de costos por lote y el registro de mermas.

## Equipo
- **Paulina Lizette Villalpando Guizar:** Product Owner.
- **Saúl Emiliano Mora Famoso:** Scrum Master.
- **Gael Iosef Ramírez Marmolejo:** equipo de desarrollo.

## Estado reportado (4 de noviembre de 2026)
| Función | Estado |
| --- | --- |
| Registro de ingredientes | Desarrollado por el equipo; código aún no publicado |
| Fichas técnicas de recetas | Desarrolladas por el equipo; código aún no publicado |
| Escalado automático de ingredientes | En desarrollo |
| Validación de inventario | Implementación por verificar |
| Cálculo de costos por lote | Implementación por verificar |
| Registro de producción y mermas | Implementación por verificar |
| Inicio de sesión y roles | Implementación por verificar |
| Dashboard de indicadores | Implementación por verificar |

**Importante:** el repositorio aún no contiene el código fuente de la aplicación; el estado funcional anterior fue comunicado por el equipo, no verificado mediante ejecución.

## Tecnologías previstas en el acta
- Frontend: HTML, CSS y JavaScript.
- Backend: Node.js.
- Base de datos: MySQL.
- Autenticación: JWT.
- Despliegue previsto: Vercel.
- Control de versiones y gestión: GitHub y GitHub Projects.

Estos componentes corresponden a la **planificación**; deben verificarse cuando se incorpore el código real.

## Instalación y ejecución
**Pendiente:** faltan el código fuente, las dependencias y las instrucciones específicas de instalación. No se proporcionan comandos de ejecución inventados. Al subir la aplicación se documentarán los requisitos, variables de entorno de ejemplo, configuración de MySQL y forma de iniciarla. **No subir contraseñas, secretos ni archivos .env reales.**

## Pruebas
- [Catálogo de casos diseñados](docs/pruebas/casos-de-prueba.md), con escenarios, datos y resultados esperados.
- [Bitácora de ejecución](docs/pruebas/registro-ejecuciones.md), todavía **sin resultados verificados**.
- [Bloqueo para ejecutar pruebas y publicar el código](../../issues/1).
- [Deuda de pruebas reproducibles](../../issues/2).

**Los casos diseñados no equivalen a pruebas realizadas.** Se documentarán fecha, resultado real, evidencia y responsable al ejecutarlos sobre Paniko.

## Arquitectura y seguimiento
- [ADR-001: elección de aplicación web](docs/adr/ADR-001-aplicacion-web.md).
- [ADR-002: stack y base de datos previstos](docs/adr/ADR-002-stack-y-persistencia.md).
- [Registro de bloqueos](docs/seguimiento/bloqueos.md).
- [Registro de deuda técnica](docs/seguimiento/deuda-tecnica.md).
- [Issue de escalado en desarrollo](../../issues/3).
- [Todos los Issues](../../issues).

## Sprint Review
Se organizó una revisión presencial con **Ale Sánchez**, dueña de Casa Dely, para el **4 de noviembre de 2026 en Tlaquepaque**. La documentación del Sprint Review debe incorporar la confirmación real y la evidencia de contacto.

## Siguientes pasos
1. Publicar el código existente de ingredientes y fichas técnicas.
2. Documentar instalación y arranque.
3. Ejecutar CP-01 a CP-05 y subir evidencia real.
4. Terminar escalado y ejecutar CP-06 y CP-07.
5. Actualizar bloqueos, deuda técnica y decisiones según la implementación.
