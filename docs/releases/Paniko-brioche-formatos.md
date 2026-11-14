# Producción de una misma masa para varios formatos — desarrollo en revisión

**Estado:** implementación en rama de trabajo, NO instalada en la panadería. No fusionar a `main` ni ejecutar migraciones con datos reales antes de validación.

## Problema de negocio

Una sola receta de masa de brioche sirve para conchas, bollos para hamburguesa y buns de mermelada y queso crema. Cada pieza consume distintos gramos de masa y, en algunos casos, rellenos/cubiertas. Duplicar la receta completa para cada producto descontrola el inventario y dificulta recalcular.

## Diseño de la función

1. **Masa base:** se selecciona una ficha técnica existente. Se registra un único rendimiento de masa en **gramos** por la receta completa (el peso real de la masa, no necesariamente la suma de insumos). Si esa ficha ya rinde gramos, no se le asigna otro rendimiento contradictorio.
2. **Formato de producto:** se vincula un producto terminado de `Productos y ventas` con la masa base, se captura su peso de masa cruda por pieza y se anotan los complementos consumidos **por pieza**. No se inventan gramajes.
3. **Complementos preparados:** costra, mermelada y otras subpreparaciones deben figurar como ingredientes de inventario con unidad `g` o `kg` (o `ml`/`l` si corresponde). **No se duplica el consumo de sus ingredientes originales** al usarlas en un bun. Su preparación se registra aparte en una ficha por gramos; por ahora el alta de existencias de la preparación requiere una entrada de inventario, no existe aún conversión automática de esa receta a stock.
4. **Lote mixto:** la persona indica cuántas piezas de cada formato hará. Paniko suma los gramos totales de masa, escala una sola vez la receta base y añade complementos por formato. Una vista previa informa consumo, faltantes y existencias.
5. **Confirmación:** una única transacción MySQL bloquea las existencias, verifica de nuevo ingredientes y productos, descuenta los consumos, crea un lote y sus movimientos y suma cada formato a su inventario de terminados. Con un fallo, **no se confirma nada**.
6. **Historial:** un mismo lote puede incluir más de un producto terminado; las producciones anteriores permanecen visibles.

### Ejemplo **ficticio**, no representa fórmulas privadas

| Formato | Masa/pieza | Extra/pieza | Cantidad | Masa total |
|---|---:|---|---:|---:|
| Concha brioche | 45 g | Costra 15 g | 10 | 450 g |
| Bollo hamburguesa | 60 g | Ninguno | 12 | 720 g |
| Bun de mermelada | 70 g | Mermelada 20 g + queso crema 15 g | 8 | 560 g |

**Total:** 30 piezas, 1730 g de masa, 150 g de costra, 160 g de mermelada y 120 g de queso crema.

El rendimiento de masa base debe representar una receta completa (por ejemplo, 1000 g de masa) y **no se altera automáticamente** cuando cambia la proporción de formatos. Queda pendiente gestionar sobrantes físicos de masa cruda: este primer flujo solo confirma un lote cuando se prepara la cantidad calculada. No registrar un amasado mayor sin llevar control de su sobrante.

## Seguridad y datos

- Configuración de recetas base y formatos: **solo administración**. Personal autenticado puede planear y confirmar producciones.
- No se envían costos a operadores. La actualización también corrige el filtrado del campo `salePrice` de productos.
- No se modifica ninguna receta o producto existente al crear un formato; se añaden relaciones y gramajes.
- Migración: `scripts/migrate-dough-formats.js --apply --confirm-backup`, previa exportación y validación de respaldo MySQL; crea cuatro tablas y cambia `uq_fpm_batch` por índice normal para soportar varios productos por lote. **No se debe ejecutar en la base real por ahora.**
- Base de pruebas debe llamarse `*_test`; `npm run db:init` incluye las tablas nuevas para CI.
- No se publica ni requiere `.env`, `private/`, recetas, costos reales ni respaldos.

## Casos cubiertos y pendientes

- Tres formatos en una sola receta base; mezcla de gramajes, complemento por pieza y diferencias de unidades `g/kg`.
- Rechazo de faltantes y formatos duplicados; rollback de cualquier fallo; seguridad de roles.
- Compatibilidad con ficha base en piezas usando su rendimiento físico total en gramos.
- Validación MySQL aislado con varios movimientos terminados en un lote.
- **Pendiente antes de instalar:** probar el módulo en la interfaz local, confirmar con usuaria los gramajes reales y vinculación de productos y preparación de rellenos; realizar copia verificable de MySQL y preparar un único actualizador acumulado.
