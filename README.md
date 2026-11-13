# Paniko — Gestión de panadería artesanal

**Versión de integración: 0.7.0 (noviembre de 2026)**  
Proyecto académico de Ingeniería Informática — Universidad de Guadalajara, CU Tlaquepaque.

Este paquete combina el código local **0.6.0** con las operaciones de **salida manual y ajuste físico de ingredientes** desarrolladas en la rama de inventario. No reemplaza automáticamente la base de datos ni las recetas privadas del negocio.

## Qué incluye

| Área | Funciones |
|---|---|
| Acceso | Inicio/cierre de sesión; perfiles de administración y operador |
| Ingredientes | Alta, existencias, entradas, salidas manuales y ajustes por conteo físico |
| Recetas operativas | Fichas técnicas, conversión g↔kg y ml↔l, escalado y vista previa |
| Producción | Descuento transaccional de insumos al confirmar producción |
| Productos terminados | Catálogo separado de recetas, categorías, inventario, ventas, mermas, ajustes, vinculación opcional con recetas operativas |
| Recetas privadas | Importador local y vista reservada a administración; fórmulas reales **no incluidas** |
| Trazabilidad | Movimientos con cantidades anteriores/nuevas, fecha y motivo; historial filtrable de lotes con detalle de consumos y producto terminado |
| Planeación de producción | Vista previa de capacidad máxima por inventario, faltantes por insumo y selección más sencilla del producto terminado vinculado |

### Nuevas rutas API (0.6.1)

- `POST /api/ingredients/:id/stock-out` con `{"quantity":250,"unit":"g","reason":"Consumo manual"}`. Registra salida sin permitir existencias negativas; convierte la unidad al formato en que se guarda el ingrediente.
- `POST /api/ingredients/:id/adjust-stock` con `{"newStock":0.75,"reason":"Conteo físico"}`. Solo **administración**; `newStock` se indica en la unidad original del ingrediente. Registra la diferencia como entrada o salida y le añade `Ajuste:` al motivo.
- `POST /api/recipes/:id/produce` sigue admitiendo `{"desiredYield":20,"productId":"UUID opcional"}` para descontar ingredientes y, cuando hay un producto vinculado, aumentar existencias de producto terminado.

## Mejora 0.6.2: planeación antes de producir

- Al calcular la vista previa de una receta, se muestra un **límite conservador de piezas posibles** con las existencias actuales, los ingredientes limitantes y cuánto falta para el pedido solicitado. La estimación usa la precisión de seis decimales empleada por MySQL; no reserva inventario.
- El botón **Usar máximo disponible** completa automáticamente la cantidad para volver a calcularla.
- Si solo existe un producto terminado activo vinculado a la receta seleccionada, Paniko lo elige automáticamente cuando cambias de receta; puedes elegir **Sin producto vinculado** si solo quieres descontar ingredientes.
- Al confirmar la producción, el servidor vuelve a verificar stock y actualiza insumos y producto terminado dentro de la misma transacción de MySQL; por eso la vista previa puede cambiar si se registra otro movimiento entretanto.
- **No hay cambios en el esquema SQL ni en las credenciales de MySQL.** La base de datos que ya usabas con MySQL Workbench sigue siendo la misma. Workbench es la interfaz administrativa, no una base de datos diferente.

## Inicio local

Requisitos: Node.js 22 (recomendado), MySQL 8, Git opcional para publicación.

1. Crea un archivo `.env` **en tu computadora**, usando `.env.example` como guía. No publiques este archivo.
2. Configura `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`. Utiliza una cuenta MySQL con permisos adecuados solo sobre la base de Paniko.
3. Desde PowerShell en la carpeta del proyecto, ejecuta:

   ```powershell
   npm.cmd install
   node --env-file=.env scripts/init-db.js
   node --env-file=.env server.js
   ```

4. Abre `http://127.0.0.1:3000`. La primera cuenta debe crearse con `node --env-file=.env scripts/create-admin.js`, siguiendo las instrucciones del programa.

El comando `node --env-file` funciona con las versiones recientes de Node. Si ya configuras las variables en tu entorno, también puedes usar `npm.cmd run db:init` y `npm.cmd start`.

## Pruebas

```powershell
npm.cmd test
```

La interfaz 0.7.0 se probó localmente con datos ficticios: **44 pruebas aprobadas, 4 omitidas por requerir MySQL de pruebas, 0 fallidas**. Las pruebas omitidas se ejecutan en GitHub Actions con MySQL aislado. Para las de MySQL, usa solamente una base separada con nombre terminado en `_test` y `MYSQL_TEST=1`. La aprobación de pruebas locales no equivale a una validación de negocio en producción.

## Privacidad y seguridad

- **No** subir archivos `.env`, `private/`, `node_modules/`, respaldos MySQL, credenciales ni fórmulas privadas.
- Este ZIP ya fue preparado sin esos archivos; el ZIP original no es apto para publicarse íntegramente.
- La app está destinada a uso local y pruebas. No exponer a Internet sin auditoría de seguridad, configuración TLS, controles de permisos y pruebas adicionales.
- La información de recetas no se importa ni se modifica con esta actualización. Conserva tus respaldos y verifica la migración en una **base de pruebas** antes de trabajar con datos reales.

## Actualización del programa existente y GitHub

- Para actualizar tu instalación **sin reemplazar la conexión a MySQL**, descomprime el ZIP en una carpeta separada y usa `ACTUALIZAR_PROGRAMA.ps1` indicando la ruta de tu Paniko actual. El instalador respalda únicamente los archivos que modifica y no toca `.env`, `private/`, `data/` ni tablas MySQL. Revisa también `ACTUALIZACION_0.7.0.txt`.
- Se actualiza por separado la rama `integracion/paniko-0.6.1-20261111-1923` de GitHub con la mejora 0.7.0. La rama principal `main` permanece sin cambios hasta aprobar las pruebas y revisar la Pull Request #9.
- **No hace falta volver a ejecutar** el script de sincronización de la versión anterior.

Repositorio: https://github.com/paulinalizette70-boop/Paniko

## Documentación adicional

- `docs/` contiene decisiones de arquitectura, evidencias históricas de pruebas y formato de recetas.
- `tests/` contiene validaciones de dominio, autenticación, productos, inventario e integración.
- `sql/` y `scripts/init-db.js` contienen el esquema inicial; las tablas se crean si no existen. Haz respaldos antes de cambios en una base que ya tenga datos.

## Novedad 0.6.3: historial de lotes (solo lectura)

- El historial de Producción ahora muestra los últimos 100 lotes, fecha, receta, piezas, costo estimado y costo estimado por pieza. Permite filtrar por receta y abrir el detalle de un lote.
- Cada detalle muestra las cantidades de ingredientes realmente descontadas, los saldos antes/después registrados en los movimientos y, cuando corresponda, la incorporación de piezas al inventario de productos terminados. Los costos son estimados al momento de confirmar.
- Nuevo endpoint autenticado **GET `/api/production/:id`**. No crea, edita ni elimina registros. No se requieren migraciones SQL; la información ya se encontraba en `production_batches`, `production_batch_items`, `inventory_movements` y `finished_product_movements`.
- Se conserva la conexión a MySQL de la versión anterior y los archivos locales `.env`, `private/` y `data/`.

## Rediseño 0.7.0: una interfaz más fácil de usar

Paniko ahora organiza sus operaciones en secciones independientes: **Inicio**, **Producción**, **Ingredientes**, **Recetas**, **Productos y ventas**, **Historial** y **Recetas privadas** (solo administración).

- **Inicio** ofrece un resumen de ingredientes, recetas y lotes consultados, más accesos directos a las tareas más frecuentes.
- **Producción** separa seleccionar receta y cantidad, calcular una vista previa, y confirmar. **Confirmar producción** permanece desactivado hasta calcular una vista previa con inventario suficiente. Si cambias receta o cantidad, debes recalcular; el servidor vuelve a validar existencias al confirmar.
- **Ingredientes y Recetas** incluyen búsquedas sin distinguir acentos y formularios de creación plegables; los formularios de creación y los ajustes quedan ocultos a operadores sin permiso.
- **Productos y ventas** muestra la acción **Registrar venta**, permite buscar por nombre o categoría y filtrar productos con stock bajo. La venta sigue usando el servicio de movimientos existente.
- **Historial** agrupa los detalles de lotes y los movimientos de ingredientes, sin cambios en sus APIs.
- El diseño se adapta a pantallas pequeñas y mantiene etiquetas, avisos de estado, navegación por teclado y compatibilidad con movimiento reducido. No necesita librerías, servicios ni fuentes externas.
- **No hay cambios de esquema SQL, credenciales, datos, recetas privadas ni APIs del servidor.** Los archivos reemplazados son HTML, CSS, JavaScript de la interfaz, metadatos de versión y documentación.

### Cómo actualizar la instalación existente de Paniko 0.6.3

1. Detén el servidor actual (`Ctrl+C`).
2. Descomprime el ZIP `Paniko_0.7.0_redisenio_facil.zip` en una carpeta distinta de tu instalación.
3. En PowerShell dentro de `Paniko-0.7.0`, ejecuta:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ACTUALIZAR_PROGRAMA.ps1 -Destino "D:\Paniko-main\Paniko-main"
   ```

4. Revisa la ruta y confirma escribiendo `ACTUALIZAR`. Se crea una copia de los archivos de código modificados junto a la carpeta actual de Paniko.
5. Vuelve a la carpeta de Paniko y ejecuta `npm.cmd test` y `node --env-file=.env server.js`.
6. Abre `http://127.0.0.1:3000` y presiona `Ctrl+F5` para renovar los archivos CSS y JavaScript en el navegador.

Esta actualización exige partir de la versión 0.6.3. Si tienes otra versión, **no la fuerces** y revisa la compatibilidad antes de instalar.
