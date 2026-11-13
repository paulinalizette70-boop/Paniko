# Deudas técnicas y funcionales identificadas

| Tema | Estado | Riesgo / acción |
| --- | --- | --- |
| Persistencia JSON principal | Sustituida por MySQL; JSON sigue en tests | Mantener adaptador aislado; ver [ADR-004](../adr/ADR-004-mysql-transacciones-inventario.md) |
| Conversión g↔kg y ml↔l | Implementada en código y con pruebas técnicas; Ale reportó dificultad con g↔kg **al crear fichas técnicas** en v0.4 | [Incidencia #11](https://github.com/paulinalizette70-boop/Paniko/issues/11): reproducir creación de fichas con ingrediente existente en kg y cantidad en g (y viceversa), luego escalado y descuento; comprobar en v0.7.1 y no cerrar sin evidencia |
| Autenticación y roles | Implementados en rama v0.7.1 y probados de forma automática | PR #9 aún no fusionado; comprobar permisos reales en Windows/MySQL, especialmente sección financiera |
| Mermas y cierre formal de lotes | Hay movimientos de producto terminado; cierre formal de lotes por verificar | Evaluar el ciclo completo de producción y conciliación de cantidades |
| Migración de registros históricos | Pendiente | No migrar ni sobreescribir datos reales sin copia de seguridad |
| Prueba con Ale | Realizada durante **tres días en v0.4**; [informe](evaluacion-usuaria-ale-v04.md) | Aporta retroalimentación cualitativa positiva y problemas de navegación y equivalencia g↔kg; no equivale a aprobación de v0.7.1 |
| Rediseño de la interfaz | Implementado en v0.7.0/0.7.1 | Volver a probar con Ale para confirmar que la navegación es clara |
| Dashboard financiero semanal | **No implementado**; nueva [HU-11](https://github.com/paulinalizette70-boop/Paniko/issues/10) | Definir ventas, inversión, ganancias y pérdidas con Ale, garantizar trazabilidad y acceso solo admin |
| Capturas y documentación de medio término | Parcial | Incorporar capturas auténticas, evidencias de PR revisado y aceptación documentada |

Las evidencias actuales no justifican afirmar que Ale haya aceptado la v0.7.1 ni que el dashboard financiero exista.
