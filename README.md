# Paniko — Gestión de panadería artesanal

**Versión de integración: 0.7.1 (noviembre de 2026)**  
Proyecto académico de Ingeniería Informática — Universidad de Guadalajara, CU Tlaquepaque.

Este paquete combina el código local **0.6.0** con las operaciones de **salida manual y ajuste físico de ingredientes** desarrolladas en la rama de inventario. No reemplaza automáticamente la base de datos ni las recetas privadas del negocio.

## Corrección para instalaciones actualizadas desde 0.6.0 (inventario 0.7.1)

**Importante:** El actualizador ZIP 0.7.1 original omitió copiar `src/inventory.js` cuando se instalaba sobre la versión local 0.6.0. Esto deja las operaciones de salida y ajuste físico con el error `TypeError: stockExit is not a function` o `stockAdjustment is not a function`, aunque el servidor MySQL inicie.

La solución es instalar el `src/inventory.js` que ya está incluido en **esta rama de GitHub** y que exporta ambas funciones. Respaldar el archivo local antes de sustituirlo. **No se modifican la base MySQL, `.env`, `private/`, recetas ni existencias.** Después, ejecutar `npm.cmd test` y comprobar que `INV-01`, `INV-02`, `INV-03` aprueben. No registrar movimientos reales hasta entonces.

Para futuras entregas, el instalador desde una versión 0.6.0 **debe incluir también `src/inventory.js`** en su manifiesto. Más detalles en [la nota de corrección](docs/releases/Paniko-0.7.1-correccion-inventario.md).

## Qué incluye

| Área | Funciones |
|---|---|
| Acceso | Inicio/cierre de sesión; perfiles de administración y operador |
| Ingredientes | Alta, existencias, entradas, salidas manuales y ajustes por conteo físico |
| Recetas operativas | Fichas técnicas, conversión g↔kg y ml↔l, escalado y vista previa |
| Producción | Descuento transaccional de insumos al confirmar producción |
| Productos terminados | Catálogo separado de recetas, categorías, inventario, ventas, mermas, ajustes, vinculación opcional con recetas operativas |
| Recetas para todo el equipo | Fichas escalables y recetas originales consultables por toda cuenta; creador de fichas desde el catálogo local |
| Finanzas (solo administración) | Costos, valoración de insumos y edición de precios, protegidos también en la API |
| Trazabilidad | Movimientos con cantidades anteriores/nuevas, fecha y motivo; historial filtrable de lotes con detalle de consumos y producto terminado |
| Planeación de producción | Vista previa de capacidad máxima por inventario, faltantes por insumo y selección más sencilla del producto terminado vinculado |

### Nuevas rutas API (0.6.1)

- `POST /api/ingredients/:id/stock-out` con `{"quantity":250,"unit":"g","reason":"Consumo manual"}`. Registra salida sin permitir existencias negativas; convierte la unidad al formato en que se guarda el ingrediente.
- `POST /api/ingredients/:id/adjust-stock` con `{"newStock":0.75,"reason":"Conteo físico"}`. Disponible para operadores y administración; `newStock` se indica en la unidad original del ingrediente. Registra la diferencia como entrada o salida y le añade `Ajuste:` al motivo.
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

La integración 0.7.1 superó localmente **52 pruebas, sin fallos y con 5 omitidas que requieren MySQL de pruebas**. Las pruebas omitidas se ejecutan en GitHub Actions con MySQL aislado. Para las de MySQL, usa solamente una base separada con nombre terminado en `_test` y `MYSQL_TEST=1`. La aprobación de pruebas locales no equivale a una validación de negocio en producción.

## Privacidad y seguridad

- **No** subir archivos `.env`, `private/`, `node_modules/`, respaldos MySQL, credenciales ni fórmulas privadas.
- Este ZIP ya fue preparado sin esos archivos; el ZIP original no es apto para publicarse íntegramente.
- La app está destinada a uso local y pruebas. No exponer a Internet sin auditoría de seguridad, configuración TLS, controles de permisos y pruebas adicionales.
- El instalador no importa ni modifica recetas por sí solo; únicamente al elegir explícitamente «Crear ficha técnica» se guardará una ficha. Conserva tus respaldos y verifica la migración en una **base de pruebas** antes de trabajar con datos reales.

## Actualización del programa existente y GitHub

- Para actualizar tu instalación **sin reemplazar la conexión a MySQL**, descomprime el ZIP en una carpeta separada y usa `ACTUALIZAR_PROGRAMA.ps1` indicando la ruta de tu Paniko actual. El instalador respalda únicamente los archivos que modifica y no toca `.env`, `private/`, `data/` ni tablas MySQL. Revisa también `ACTUALIZACION_0.7.1.txt`.
- Se actualiza por separado la rama `integracion/paniko-0.6.1-20261111-1923` de GitHub con la mejora 0.7.1. La rama principal `main` permanece sin cambios hasta aprobar las pruebas y revisar la Pull Request #9.
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

Paniko organiza sus operaciones en **Inicio**, **Producción**, **Ingredientes**, **Recetas** (para todo el personal), **Productos y ventas**, **Historial** y **Finanzas** (solo administración).

- **Inicio** ofrece un resumen de ingredientes, recetas y lotes consultados, más accesos directos a las tareas más frecuentes.
- **Producción** separa seleccionar receta y cantidad, calcular una vista previa, y confirmar. **Confirmar producción** permanece desactivado hasta calcular una vista previa con inventario suficiente. Si cambias receta o cantidad, debes recalcular; el servidor vuelve a validar existencias al confirmar.
- **Ingredientes y Recetas** incluyen búsquedas sin distinguir acentos y formularios de creación plegables; el personal puede crear fichas técnicas y registrar movimientos; las cifras financieras no se ofrecen a operadores.
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

## Versión 0.7.1: recetas compartidas y fichas técnicas escalables

- Todas las personas con cuenta en Paniko consultan las **recetas originales** y las **fichas técnicas** desde una sola sección **Recetas**. No existe una sección de recetas exclusiva del administrador.
- **Finanzas** es exclusiva de administración. El servidor retira costos y valores financieros de las respuestas para operadores y deniega las rutas `/api/finance/*` con HTTP 403. El personal puede operar inventario, recetas, producción y productos; los precios los fija administración.
- Cada fórmula original **confirmada y completa** puede transformarse en ficha de producción con el botón **Crear ficha técnica escalable**, o utilizar **Crear las fichas completas** para convertir en una operación guiada todas las que tienen rendimiento en piezas conocido.
- La transformación se ejecuta al confirmar, en una transacción MySQL: reutiliza ingredientes del inventario si su nombre y unidad son compatibles, agrega los faltantes con **stock 0 y costo 0** y registra la ficha con las cantidades originales. **No se descuentan existencias durante la importación.** No duplica una receta que ya existe con el mismo nombre.
- No se hacen conversiones arbitrarias de cucharadas a gramos; no se crea una ficha desde una fórmula provisional ni una subpreparación sin revisar. Para fórmulas expresadas en gramos de masa o placas de masa, Paniko pide el número real de piezas del lote. **No se estima ni inventa.**
- Nuevo endpoint autenticado `POST /api/recipes/from-catalog/:catalogId` con `{"baseYield":5}`, que utiliza los datos **almacenados en MySQL** y no datos externos. No publica fórmulas reales en GitHub.
- No hay migraciones SQL ni cambios de credenciales, recetas locales o datos de inventario. Si las fórmulas originales no aparecen, comprueba que el catálogo local haya sido importado anteriormente con el script `scripts/import-private-recipes.js`; la app no leerá el archivo de recetas directamente desde Internet.
- Las fórmulas antiguas siguen en tablas de staging llamadas `private_catalog_*` por compatibilidad, pero ahora son consultables **dentro de Paniko** para usuarios autenticados. «Privado» se refiere a que las fórmulas reales nunca deben publicarse en el repositorio GitHub.

## Evaluación de usuaria y necesidades de negocio

Ale Sánchez probó **Paniko v0.4** en el periodo del **4 al 7 de noviembre de 2026**, con **tres días de uso reportados**. Reportó que el sistema le ayudó, pero que una pantalla con toda la información resultaba confusa; también solicitó un resumen **semanal** de ventas, ganancias, inversión y pérdidas.

Ale también reportó que Paniko v0.4 no identificaba correctamente la equivalencia entre **gramos y kilogramos al crear fichas técnicas**, cuando un ingrediente existente se utilizaba en una unidad diferente. La conversión `g↔kg` existe en el código y cuenta con pruebas automatizadas, pero falta comprobar el flujo completo que presentó problemas. [Seguimiento de conversión #11](https://github.com/paulinalizette70-boop/Paniko/issues/11).

El rediseño v0.7.0/0.7.1 reorganiza las tareas en secciones independientes. Esto **aún debe revalidarse con Ale**; no se atribuye a la usuaria una prueba de v0.7.1.

- [Evaluación de la versión 0.4](docs/seguimiento/evaluacion-usuaria-ale-v04.md)
- [Retrospectiva y backlog](docs/seguimiento/retrospectiva-medio-termino.md)
- [HU-11: dashboard financiero semanal (pendiente)](https://github.com/paulinalizette70-boop/Paniko/issues/10)

## Colaboración y contribuciones

Para colaborar, crear una rama de trabajo desde la base que corresponda, documentar el problema o historia de usuario, modificar el código con datos ficticios y ejecutar `npm test`. Abrir un Pull Request con descripción de cambios, pruebas, riesgos y capturas **sin datos sensibles**. Solicitar revisión a otro integrante y atender sus comentarios antes de fusionar. No trabajar directamente sobre `main` si se trata de una funcionalidad nueva. [PR #9: integración del MVP](https://github.com/paulinalizette70-boop/Paniko/pull/9).

## Capturas

Las capturas reales del sistema todavía deben añadirse para la entrega, con datos de demostración (no recetas privadas, contraseñas ni cifras sensibles). Las pantallas clave a documentar son Inicio, Ingredientes, Recetas, Producción, Productos y ventas, e Historial.

## Licencia y uso

El paquete actual declara `UNLICENSED` y no incluye una licencia de software libre que permita redistribución o reutilización general. La elección de una licencia para el código está **pendiente de decisión del equipo**. El carácter público de GitHub no implica autorización para publicar las fórmulas de la panadería, que se mantienen fuera del repositorio.
