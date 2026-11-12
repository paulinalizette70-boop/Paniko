# Paniko — Gestión de panadería artesanal

**Versión de integración: 0.6.1 (noviembre de 2026)**  
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
| Trazabilidad | Movimientos con cantidades anteriores/nuevas, fecha y motivo |

### Nuevas rutas API (0.6.1)

- `POST /api/ingredients/:id/stock-out` con `{"quantity":250,"unit":"g","reason":"Consumo manual"}`. Registra salida sin permitir existencias negativas; convierte la unidad al formato en que se guarda el ingrediente.
- `POST /api/ingredients/:id/adjust-stock` con `{"newStock":0.75,"reason":"Conteo físico"}`. Solo **administración**; `newStock` se indica en la unidad original del ingrediente. Registra la diferencia como entrada o salida y le añade `Ajuste:` al motivo.
- `POST /api/recipes/:id/produce` sigue admitiendo `{"desiredYield":20,"productId":"UUID opcional"}` para descontar ingredientes y, cuando hay un producto vinculado, aumentar existencias de producto terminado.

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

La integración fue probada localmente con datos ficticios: **33 pruebas aprobadas, 4 omitidas por requerir MySQL de pruebas, 0 fallidas**. Para las de MySQL, usa solamente una base separada con nombre terminado en `_test` y `MYSQL_TEST=1`. La aprobación de pruebas locales no equivale a una validación de negocio en producción.

## Privacidad y seguridad

- **No** subir archivos `.env`, `private/`, `node_modules/`, respaldos MySQL, credenciales ni fórmulas privadas.
- Este ZIP ya fue preparado sin esos archivos; el ZIP original no es apto para publicarse íntegramente.
- La app está destinada a uso local y pruebas. No exponer a Internet sin auditoría de seguridad, configuración TLS, controles de permisos y pruebas adicionales.
- La información de recetas no se importa ni se modifica con esta actualización. Conserva tus respaldos y verifica la migración en una **base de pruebas** antes de trabajar con datos reales.

## Sincronización con GitHub

Esta carpeta incluye `SINCRONIZAR_GITHUB.ps1`, un script opcional que crea una **rama nueva** en una copia temporal del repositorio y coloca en ella únicamente las carpetas de código permitidas. No modifica `main` ni borra tus archivos privados. Antes de publicar, muestra los cambios y pide confirmación. Después puedes abrir una Pull Request para revisar la integración.

Repositorio: https://github.com/paulinalizette70-boop/Paniko

**Estado de publicación:** la Pull Request #8 contiene el módulo de inventario sobre la base 0.4.0. La **integración completa 0.6.1 del ZIP todavía no está publicada** hasta que se ejecute el proceso de sincronización de este paquete (o se suba mediante una rama revisada).

## Documentación adicional

- `docs/` contiene decisiones de arquitectura, evidencias históricas de pruebas y formato de recetas.
- `tests/` contiene validaciones de dominio, autenticación, productos, inventario e integración.
- `sql/` y `scripts/init-db.js` contienen el esquema inicial; las tablas se crean si no existen. Haz respaldos antes de cambios en una base que ya tenga datos.
