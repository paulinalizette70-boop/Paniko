# Bitácora de pruebas ejecutadas

**Fecha:** 4 de noviembre de 2026 (México). **Comando:** `npm test`. **Entorno verificado:** Node.js v22.16.0, npm 10.9.2, equipo de pruebas local.

**Resultado real del comando:** 9 subpruebas, **9 aprobadas, 0 fallidas, 0 omitidas**.

## Evidencia

- [GitHub Actions: ejecución remota satisfactoria](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41957663860) — workflow `Pruebas Paniko`, concluido con estado **success**.

- [Registro íntegro de consola](evidencia-ejecucion-2026-11-04.txt)
- [Código de pruebas unitarias](../../tests/domain.test.js)
- [Código de pruebas de integración](../../tests/integration.test.js)

| Grupo | Prueba | Estado | Observación |
| --- | --- | --- | --- |
| Unitario | CP-01, CP-02, CP-03 | Aprobado | Validaciones de ingrediente |
| Unitario | CP-04, CP-06, CP-07 | Aprobado | Fichas y escalado |
| Unitario | CP-08, CP-09 | Aprobado | Referencias y stock |
| Integración HTTP | CP-01, CP-02, CP-04, CP-05, CP-06, CP-07, CP-09 | Aprobado | API, persistencia temporal y vista previa |

> Estos resultados corresponden a **pruebas técnicas ejecutadas**, no a aceptación por stakeholders ni a pruebas de módulos todavía pendientes.
