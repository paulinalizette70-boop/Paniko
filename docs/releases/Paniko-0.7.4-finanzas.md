# Paniko 0.7.4 — Costos y precios de productos

Se resuelve la imposibilidad de capturar el costo de elaboración de un producto terminado como administrador.

## Diferencias

- **Costo unitario de elaboración**: importe manual por pieza, opcional, distinto del costo de ingrediente de la ficha y del precio al público.
- **Precio de venta**: importe por pieza que se cobra al cliente, independiente del costo.
- **Costos y precios de productos**: panel exclusivo de administración en **Finanzas**, con guardado por producto.
- **Productos y ventas** conserva su catálogo, movimientos y ventas habituales. El administrador tiene un acceso desde esa pantalla hasta Finanzas.

Las cuentas de operador no pueden consultar ni cambiar costos unitarios del producto; la ruta financiera devuelve 403. El servidor valida importes y autorización; no se confía solo en ocultar formularios.

## Base de datos

La migración `scripts/migrate-product-cost.js` añade únicamente la columna nullable `finished_products.unit_cost` (`DECIMAL(14,2)`), con comprobación de existencia previa. **No elimina ni actualiza filas** y no toca `.env`, recetas, lotes, inventario ni ventas. Precios previos se conservan, costos previos se mantienen **sin definir** (`NULL`).

**Antes de la migración**, exporta una copia de seguridad de la base `paniko` desde MySQL Workbench. Si prefieres ejecutar la migración manualmente, cierra Paniko, entra a la carpeta del programa y ejecuta:

```powershell
node --env-file=.env scripts/migrate-product-cost.js
node --env-file=.env scripts/migrate-product-cost.js --apply
```

El instalador de esta versión hace esa migración después de pedir autorización, y respalda automáticamente los archivos de código que sustituye.

## API

- `GET /api/finance/products` — solo administrador, devuelve id, nombre, piezas y costo/precio unitarios.
- `POST /api/finance/products/:uuid/pricing` — solo administrador, cuerpo `{ "unitCost": 22.5, "salePrice": 45 }` (pueden ser `null`).

## Limitaciones

El costo es **manual** y no se recalcula automáticamente a partir de recetas, mermas o mano de obra. La diferencia entre precio y costo no constituye utilidad neta contable. No modifica movimientos anteriores.
