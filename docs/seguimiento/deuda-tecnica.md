# Deudas técnicas y funcionales identificadas

| Tema | Estado | Riesgo / acción |
| --- | --- | --- |
| Persistencia JSON principal | Sustituida por MySQL en v0.2; JSON sigue en tests | Mantener adaptador de tests separado; ver [ADR-004](../adr/ADR-004-mysql-transacciones-inventario.md) |
| Conversión de unidades g↔kg y ml↔l | Implementada en v0.4.0, pendiente de validación de aceptación | Normaliza fichas y entradas; no convierte dimensiones incompatibles. Ver [ADR-006](../adr/ADR-006-conversion-unidades.md) |
| Autenticación y roles | Pendiente | **No exponer la aplicación públicamente:** cualquiera con acceso a la API podría modificar inventario |
| Mermas y cierre formal de lotes | Pendiente | La producción solo registra consumo, no el ciclo completo |
| Migración de datos JSON históricos | Pendiente | Los registros de v0.1 no se transfieren automáticamente a MySQL |
| Pruebas de aceptación con negocio | Pendiente | Requiere validación real con Ale Sánchez |

Ver [Issues abiertos](https://github.com/paulinalizette70-boop/Paniko/issues).
