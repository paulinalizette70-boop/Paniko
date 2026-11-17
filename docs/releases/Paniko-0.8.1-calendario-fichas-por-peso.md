# Paniko 0.8.1 — Calendario visual y fichas por rendimiento de peso/volumen

## Para qué sirve

- Inicio muestra un calendario mensual accesible para administración y operación con tres indicadores visuales: pendientes, producción planificada y lotes realmente confirmados.
- Permite crear y quitar pendientes, programar preparaciones con receta y cantidad opcional, y marcar tareas como hechas o pendientes.
- Las producciones confirmadas **se leen del historial MySQL** y aparecen automáticamente en el día correspondiente. La planificación por sí sola no registra producción ni descuenta ingredientes.
- Las fichas técnicas pueden tener rendimiento en **piezas**, **gramos (g)** o **mililitros (ml)**. Una receta cuya fuente indica kg/l convierte el rendimiento base a g/ml para escalar por cantidades más pequeñas.
- Ejemplo con cantidades ficticias: si una receta entrega 1,000 g de crumble y consume 200 g de un ingrediente, pedir 250 g calcula 50 g de ese ingrediente.
- No se inventa cuántas piezas produce una receta de mermelada, relleno o decoración. El porcentaje panadero puede indicar que no aplica si no existe harina.
- Las piezas terminadas solo se incrementan automáticamente al confirmar recetas cuyo rendimiento está expresado en piezas; las preparaciones en g/ml solo descuentan insumos.

## Persistencia y compatibilidad

Esta actualización requiere la migración idempotente `scripts/migrate-calendar-yields-081.js --apply`:

1. Agrega `yield_unit` a `recipes`, por defecto `pieza` para fichas existentes.
2. Agrega `yield_unit` a `production_batches`, por defecto `pieza` para registros históricos.
3. Crea la tabla nueva `calendar_entries` para tareas y planes; las producciones reales permanecen en `production_batches`.

La migración no modifica precios, ingredientes, existencias, fichas existentes ni ventas. Los cambios de esquema de MySQL no son completamente transaccionales: **exporta primero un respaldo en Workbench**. Si falla, revisa el error y vuelve a ejecutar la migración después de corregirlo; es idempotente.

El instalador admite Paniko **0.7.4 y 0.8.0**, crea un respaldo del código y conserva `.env`, `private/`, `data/`, `node_modules/` y los datos MySQL. Si provienes de 0.7.4, aplica antes la migración aditiva financiera y de masa madre de 0.8.0.

### Verificación

Desde la carpeta real del programa:

```powershell
node -p "require('./package.json').version"
npm.cmd test
node --env-file=.env server.js
```

Luego presiona Ctrl + F5 en http://127.0.0.1:3000, abre Inicio y comprueba el calendario. Verifica también Recetas > Crear/Editar ficha > Unidad de rendimiento; sin confirmar una producción, crea una ficha de prueba en gramos. Solo tras revisar los cálculos con datos reales confirma operaciones del inventario.

**Privacidad:** no se distribuyen fórmulas, contraseñas, datos de ventas ni bases de datos reales.
