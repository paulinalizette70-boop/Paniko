# Paniko — Gestión de producción para panaderías artesanales

Aplicación web académica de **Seminario de Integración: Desarrollo**, Universidad de Guadalajara, Centro Universitario de Tlaquepaque.

**Versión:** 0.2.0 (noviembre de 2026). Se priorizó la **gestión de inventario en MySQL** y el uso de **recetas reales aportadas por el equipo**. Todavía no se han incorporado esas recetas: se esperan los ingredientes y rendimientos auténticos.

## Qué permite hacer esta versión

1. Registrar ingredientes con unidad (g, kg, ml, l o pieza), costo unitario y existencia inicial.
2. Registrar fichas técnicas de recetas con ingredientes, cantidades y número de piezas por preparación.
3. Registrar **entradas** de inventario, con motivo y movimiento histórico.
4. Calcular una **vista previa** de escalado de cantidades y costos, sin descontar existencias.
5. **Confirmar una producción**: comprobar si hay ingredientes suficientes y descontarlos **en una transacción MySQL**, guardando el movimiento de salida y un registro de producción.
6. Consultar las últimas entradas/salidas y las producciones confirmadas.

**Límites importantes:** no hay autenticación ni permisos, todavía no se registran mermas ni se cierran lotes, no existe dashboard y no se convierten automáticamente unidades (g↔kg o ml↔l). El costo es estimado a partir de insumos, no incluye mano de obra, energía ni venta. **No desplegar de manera pública** antes de agregar autenticación y autorización.

## Arquitectura

- Frontend: HTML, CSS, JavaScript.
- Servidor API: Node.js 20 o superior, HTTP nativo.
- Base de datos principal: **MySQL 8.0.16+**, tablas relacionales e InnoDB.
- Cliente MySQL: [mysql2](https://www.npmjs.com/package/mysql2), con parámetros preparados.
- Componentes: `src/domain.js` (validación/escalado), `src/mysql-store.js` (persistencia y transacciones), `src/app.js` (API), `sql/schema.sql` (esquema), `public/` (interfaz).
- Adaptador JSON `src/store.js`: se conserva **solo para pruebas y desarrollo local**. El servidor normal utiliza MySQL, nunca cambia a JSON silenciosamente.

### Tablas principales

`ingredients`, `recipes`, `recipe_items`, `inventory_movements`, `production_batches` y `production_batch_items`.

## Instalación local con MySQL

Requisitos: Node.js >=20, MySQL 8.0.16+, permisos para crear tablas en una base de datos de desarrollo.

1. Clona o descarga el repositorio y abre la carpeta en una terminal.
2. Ejecuta `npm install`.
3. Copia `.env.example` como `.env` y rellena `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Usa **credenciales de desarrollo** y nunca publiques `.env`.
4. Crea el esquema y las tablas con `node --env-file=.env scripts/init-db.js`. Si tu usuario de MySQL no tiene permiso para crear bases de datos, créala previamente desde MySQL Workbench y concede permisos para tablas.
5. Inicia con `node --env-file=.env server.js`.
6. Abre <http://localhost:3000>.

Comandos equivalentes con variables de entorno ya definidas: `npm run db:init`, `npm start`.

**Windows/PowerShell:** `Copy-Item .env.example .env` para crear `.env`.
**Linux/macOS:** `cp .env.example .env`.

> Importante: el archivo `.env.example` es únicamente un ejemplo. Cambia la contraseña ficticia. Ni la base de datos ni las credenciales se incluyen en GitHub. Los datos JSON de la versión anterior **no se migran automáticamente** a MySQL.

## Flujo de inventario

1. Crear *Harina de trigo* con unidad kg, costo por kg y existencia inicial (o 0).
2. Registrar entrada de inventario por compra, por ejemplo 2 kg. El sistema genera un movimiento de tipo `entrada`.
3. Registrar una ficha técnica con las cantidades expresadas en las **mismas unidades** del catálogo.
4. Escalar de 10 a 20 piezas y comprobar el inventario.
5. Pulsar **Confirmar producción**. Si existe stock suficiente, el sistema registra la producción y movimientos de `salida`, y descuenta cantidades. Si falta algún ingrediente, responde HTTP 409 y **no cambia el inventario**.

Las producciones se confirman como registros de consumo de insumos; aún no existe flujo de estados de lote, cierre ni merma. La validación final por Ale Sánchez sigue pendiente.

## API principal

| Método | Ruta | Uso |
|---|---|---|
| GET / POST | `/api/ingredients` | Listar / registrar ingredientes |
| GET / POST | `/api/recipes` | Listar / registrar fichas |
| POST | `/api/ingredients/:id/stock-in` | Registrar entrada de inventario `{ "quantity": 2, "reason": "Compra" }` |
| GET | `/api/inventory/movements` | Movimientos recientes |
| POST | `/api/recipes/:id/scale` | Calcular vista previa `{ "desiredYield": 20 }` |
| POST | `/api/recipes/:id/produce` | Confirmar consumo y descontar stock `{ "desiredYield": 20 }` |
| GET | `/api/production` | Producciones recientes |

## Pruebas y evidencias

Ejecuta `npm test`.

- [Casos de prueba](docs/pruebas/casos-de-prueba.md).
- [Bitácora de pruebas](docs/pruebas/registro-ejecuciones.md).
- [Pruebas del inventario](tests/inventory.test.js).
- [Prueba de integración con MySQL](tests/mysql.test.js); solo se ejecuta con `MYSQL_TEST=1` sobre una base **_test** separada.
- [Workflow de GitHub Actions](.github/workflows/tests.yml), que instala `mysql2`, levanta MySQL 8, inicializa las tablas y ejecuta las pruebas.
- [Evidencia histórica de v0.1.0](docs/pruebas/evidencia-ejecucion-2026-11-04.txt).

> Resultados de MySQL y enlace de ejecución en GitHub Actions: consultar [bitácora](docs/pruebas/registro-ejecuciones.md). No se atribuyen pruebas de aceptación reales sin evidencia.

## Documentación del proyecto

- [Formato para incorporar recetas auténticas](docs/recetas/formato-recetas-reales.md).
- [ADR-001: aplicación web](docs/adr/ADR-001-aplicacion-web.md).
- [ADR-002: stack previsto](docs/adr/ADR-002-stack-y-persistencia.md).
- [ADR-003: JSON como solución inicial, ya superada](docs/adr/ADR-003-json-provisional.md).
- [ADR-004: MySQL y transacciones](docs/adr/ADR-004-mysql-transacciones-inventario.md).
- [Bloqueos](docs/seguimiento/bloqueos.md), [deudas técnicas](docs/seguimiento/deuda-tecnica.md), [Issues](https://github.com/paulinalizette70-boop/Paniko/issues).

## Equipo

- Paulina Lizette Villalpando Guizar — Product Owner.
- Saúl Emiliano Mora Famoso — Scrum Master.
- Gael Iosef Ramírez Marmolejo — Development Team.

**Uso:** prototipo universitario para pruebas y demostración. No cargues recetas confidenciales, datos reales de clientes ni secretos a un repositorio público sin autorización.
