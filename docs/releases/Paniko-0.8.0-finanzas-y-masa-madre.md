# Paniko 0.8.0 — Finanzas y masa madre

## Panel de administración

- Períodos: 7/30/90/365 días.
- Las nuevas ventas conservan el **precio y el costo unitario en el momento de la venta** como instantáneas inmutables. Ninguna venta antigua se recalcula con precios de hoy.
- Las ventas anteriores a esta versión (o sin costo o precio definidos) se señalan como incompletas. **En esos períodos, la utilidad bruta y neta se muestran como “Sin calcular”**; los ingresos conocidos son parciales. No se inventa un monto.
- Gastos manuales con categoría, concepto, importe y fecha. **Evitar duplicar como gastos los ingredientes que ya forman parte del costo de elaboración de un producto**.
- Cálculo de utilidad bruta = ingresos por ventas − costo de productos vendidos; utilidad neta = bruta − gastos capturados. Valores aproximados operativos, sin impuestos, depreciaciones ni cuentas por cobrar.
- Solo administradores pueden consultar el panel o registrar gastos; protegido por servidor (HTTP 403 para operadores).

## Cuidado de masa madre

- Disponible para administradores y operadores que tengan sesión iniciada.
- Registra cultivos, ubicación, peso conocido, intervalo configurable y notas.
- Bitácora de alimentaciones: cantidad previa, descarte, harina, agua, peso resultante y observaciones.
- Hidratación mostrada = agua nueva / harina nueva × 100; **no es la hidratación total del cultivo**.
- Próxima revisión = última alimentación + intervalo configurado; solo visual en la web cuando se abre. No hay recordatorios automáticos.
- Los registros de masa madre **no mueven el inventario de harina ni de agua**.

## Base de datos y privacidad

Se añaden **cuatro tablas** `sale_financial_snapshots`, `financial_expenses`, `sourdough_starters`, `sourdough_feedings` con `CREATE TABLE IF NOT EXISTS`. No se borran ni reescriben tablas o ventas antiguas. Requiere exportar un respaldo completo de MySQL antes de ejecutar `node --env-file=.env scripts/migrate-finance-and-starter.js --apply` en el programa. Si ya se aplicó, la migración se puede repetir sin duplicar tablas.

El ZIP y GitHub **no incluyen** `.env`, `private/`, registros reales de recetas, inventarios o credenciales.

## Limitaciones

- El registro financiero empieza con las ventas posteriores a la migración. Las anteriores se conservan en inventario, pero requieren importes históricos verificados si se quiere reconstruir la contabilidad anterior.
- No se calculan impuestos ni depreciación. Los costes dependen de las cifras que administración capture en Productos.
- La alimentación es un registro operativo, no una recomendación universal de tiempos o condiciones: la persona responsable decide la frecuencia según su cultivo.
