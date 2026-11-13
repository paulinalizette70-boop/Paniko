# Entrega GitHub — Paniko
**Seminario de Integración: Desarrollo · Universidad de Guadalajara**  
**Revisión de documentación:** 4 de noviembre de 2026.  
**Proyecto:** Sistema de trazabilidad y control de producción para panaderías artesanales.

## 1. Repositorio y README
- [Repositorio Paniko](https://github.com/paulinalizette70-boop/Paniko)
- [README documentado](https://github.com/paulinalizette70-boop/Paniko/blob/main/README.md)

El README describe objetivos, funcionalidades implementadas, límites del MVP, arquitectura, pruebas y enlaces de seguimiento. Las instrucciones de instalación están documentadas por separado y no forman parte de los requisitos de esta entrega.

## 2. Casos de prueba y evidencia
- [Catálogo de casos CP-01 a CP-24](https://github.com/paulinalizette70-boop/Paniko/blob/main/docs/pruebas/casos-de-prueba.md).
- [Bitácora de ejecuciones](https://github.com/paulinalizette70-boop/Paniko/blob/main/docs/pruebas/registro-ejecuciones.md).
- [GitHub Actions: ejecución v0.4.0 con 24 pruebas aprobadas, 0 fallidas y 0 omitidas](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41968225354).

| Tipo | Ubicación | Qué verifica |
| --- | --- | --- |
| Unitarias de dominio | [tests/domain.test.js](https://github.com/paulinalizette70-boop/Paniko/blob/main/tests/domain.test.js) | Ingredientes, fichas, escalado y validaciones |
| Integración HTTP | [tests/integration.test.js](https://github.com/paulinalizette70-boop/Paniko/blob/main/tests/integration.test.js) | Altas, consulta, vista previa y errores de API |
| Inventario | [tests/inventory.test.js](https://github.com/paulinalizette70-boop/Paniko/blob/main/tests/inventory.test.js) | Entradas, consumo, stock insuficiente y movimientos |
| Integración MySQL | [tests/mysql.test.js](https://github.com/paulinalizette70-boop/Paniko/blob/main/tests/mysql.test.js) | Transacciones, salidas y rechazo sin descuentos parciales |
| Catálogo privado (datos ficticios) | [tests/private-catalog.test.js](https://github.com/paulinalizette70-boop/Paniko/blob/main/tests/private-catalog.test.js) | Referencias, datos incompletos y validaciones de importación |
| Integración del importador MySQL | [tests/private-catalog-mysql.test.js](https://github.com/paulinalizette70-boop/Paniko/blob/main/tests/private-catalog-mysql.test.js) | Importación de prueba, duplicados y aislamiento de API |

**Aclaración:** los 21 resultados corresponden a subpruebas automatizadas ejecutadas con datos ficticios, no a 21 pruebas de aceptación con usuarios reales. Las recetas privadas no se publicaron ni importaron a una instancia MySQL de la panadería.

## 3. Bloqueos e incidencias
- [Registro general de bloqueos](https://github.com/paulinalizette70-boop/Paniko/blob/main/docs/seguimiento/bloqueos.md).
- [Issue #1: publicación del código — resuelto](https://github.com/paulinalizette70-boop/Paniko/issues/1).
- [Issue #2: suite inicial de pruebas — resuelto](https://github.com/paulinalizette70-boop/Paniko/issues/2).
- [Issue #3: escalado, conversiones y cierre de lote — pendiente parcial](https://github.com/paulinalizette70-boop/Paniko/issues/3).
- [Issue #5: autenticación, mermas y dashboard — pendiente](https://github.com/paulinalizette70-boop/Paniko/issues/5).
- [Issue #6: acceso protegido a recetas privadas — pendiente](https://github.com/paulinalizette70-boop/Paniko/issues/6).

## 4. ADR: decisiones de arquitectura
- [ADR-001 — Aplicación web](https://github.com/paulinalizette70-boop/Paniko/blob/main/docs/adr/ADR-001-aplicacion-web.md).
- [ADR-002 — Stack y persistencia previstos](https://github.com/paulinalizette70-boop/Paniko/blob/main/docs/adr/ADR-002-stack-y-persistencia.md).
- [ADR-003 — JSON temporal](https://github.com/paulinalizette70-boop/Paniko/blob/main/docs/adr/ADR-003-json-provisional.md).
- [ADR-004 — MySQL y transacciones de inventario](https://github.com/paulinalizette70-boop/Paniko/blob/main/docs/adr/ADR-004-mysql-transacciones-inventario.md).
- [ADR-005 — Catálogo privado y staging](https://github.com/paulinalizette70-boop/Paniko/blob/main/docs/adr/ADR-005-catalogo-privado.md).
- [ADR-006 — Conversión de unidades](https://github.com/paulinalizette70-boop/Paniko/blob/main/docs/adr/ADR-006-conversion-unidades.md).

## 5. Deudas técnicas
- [Registro de deuda técnica](https://github.com/paulinalizette70-boop/Paniko/blob/main/docs/seguimiento/deuda-tecnica.md).
- [Issue #4 — MySQL implementado; configuración local y migración pendientes](https://github.com/paulinalizette70-boop/Paniko/issues/4).
- [Issue #5 — autenticación, mermas y dashboard](https://github.com/paulinalizette70-boop/Paniko/issues/5).
- [Issue #6 — control de acceso del catálogo privado](https://github.com/paulinalizette70-boop/Paniko/issues/6).

**Estado de la versión v0.4 al cierre de esa evidencia histórica:** los tests estaban verificados en GitHub Actions. Se recibió una evaluación formativa con Ale sobre v0.4, correspondiente al periodo del **4 al 7 de noviembre de 2026** (tres días de uso reportados); se documenta abajo. No existe aprobación formal de la v0.7.1 ni se declara finalización de módulos pendientes.

## 6. Prueba con Ale (4–7 de noviembre de 2026) y hallazgos de usabilidad

- [Informe de prueba formativa de Paniko v0.4 con Ale](seguimiento/evaluacion-usuaria-ale-v04.md).
- [Retrospectiva propuesta de medio término](seguimiento/retrospectiva-medio-termino.md).
- [HU-11 — resumen financiero semanal solicitado por Ale](https://github.com/paulinalizette70-boop/Paniko/issues/10).
- La usuaria reportó que Paniko le ayudó, pero le resultaba confuso tener toda la información en una sola pantalla. La versión v0.7.0/0.7.1 implementó una reorganización visual cuya aceptación aún debe comprobarse.
- Esta prueba real de v0.4 **no debe presentarse** como aceptación de v0.7.1.

## 7. Integración y PRs

- [PR #9 — Paniko v0.7.1](https://github.com/paulinalizette70-boop/Paniko/pull/9) permanece como borrador hasta revisión formal de un integrante del equipo y comprobación local.
- [Última ejecución automatizada v0.7.1 con MySQL](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43344993724): completada satisfactoriamente.
- Pendiente actualizar README de la rama `main` tras revisar y fusionar el PR, añadir capturas reales y asegurar que ningún archivo privado se publique.
