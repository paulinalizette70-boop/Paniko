# Deudas técnicas y trabajo que nos falta revisar

En este archivo anotamos cosas que ya tienen código pero **todavía necesitan pruebas**, además de las mejoras que siguen pendientes. El estado se refiere a la versión **0.7.2 de `main`** del 13 de noviembre de 2026. Las ramas 0.7.3–0.8.3 están en PRs de desarrollo y no equivalen a cambios publicados en `main`.

| Tema | Cómo va en `main` | Qué falta |
| --- | --- | --- |
| Base de datos MySQL | Ya está implementada y tiene pruebas automatizadas | Revisar respaldos y cualquier migración de registros históricos antes de tocar datos reales |
| Conversiones de unidades | g↔kg y ml↔l están implementadas; 0.7.2 agrega equivalencias específicas de Agua/Huevo | Probar la creación de fichas desde la interfaz con unidades diferentes; [Issues #11](https://github.com/paulinalizette70-boop/Paniko/issues/11) y [#12](https://github.com/paulinalizette70-boop/Paniko/issues/12) |
| Inicio de sesión y roles | Código y pruebas automatizadas disponibles | Repetir un caso manual como operador para comprobar que no vea datos financieros |
| Salidas y mermas | Hay movimientos de ingredientes y productos terminados | Verificar las operaciones completas y el cierre/conciliación de lotes de producción |
| Diseño de las pantallas | Se reorganizó en secciones desde 0.7.0 | Mostrar el diseño nuevo a Ale para saber si ahora le parece más claro |
| Reporte financiero semanal | Todavía no está integrado a `main` | Definir con Ale qué datos se utilizarán y comprobar el reporte; [HU-11](https://github.com/paulinalizette70-boop/Paniko/issues/10) |
| Documentación de equipo | Hay README, ADRs, Issues, pruebas y PRs | Falta una revisión formal de otro integrante y terminar la evidencia individual |
| Validación con Ale | Ale probó la versión **0.4** durante tres días del 4 al 7 de noviembre | Probar una versión posterior; no usar su opinión sobre 0.4 como aceptación de 0.7.2 |

Las versiones 0.8.0–0.8.3 tienen trabajo relacionado con finanzas, calendario, masa madre y conversiones, pero siguen en **Pull Requests borrador**. Antes de presentarlas como parte del MVP integrado necesitamos revisar sus dependencias, fusionarlas y probarlas.

Podemos seguir el avance en [Issues](https://github.com/paulinalizette70-boop/Paniko/issues), el [plan de demo](../demo-medio-termino.md) y los [casos manuales](../pruebas/plan-pruebas-demo.md).
