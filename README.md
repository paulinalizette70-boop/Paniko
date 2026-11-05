# Paniko — Gestión de producción para panaderías artesanales

Aplicación web académica de **Seminario de Integración: Desarrollo**, Universidad de Guadalajara, Centro Universitario de Tlaquepaque.

**Versión:** 0.3.0 (noviembre de 2026). El MVP incorpora inventario en MySQL e importador local a tablas de preparación. Las fórmulas reales **no están publicadas ni cargadas en el MySQL de la panadería**; su importación y validación operativa continúan pendientes.

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

Ejecuta `npm test`. La última ejecución verificada en GitHub Actions terminó con **21 pruebas aprobadas, 0 fallidas y 0 omitidas**, incluyendo MySQL temporal con datos ficticios.

- [Última ejecución aprobada de GitHub Actions (21/21)](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41965295559).
- [Índice de evidencias para entregar](docs/entrega-github.md).

- [Casos de prueba](docs/pruebas/casos-de-prueba.md).
- [Bitácora de pruebas](docs/pruebas/registro-ejecuciones.md).
- [Pruebas del inventario](tests/inventory.test.js).
- [Prueba de integración con MySQL](tests/mysql.test.js); solo se ejecuta con `MYSQL_TEST=1` sobre una base **_test** separada.
- [Workflow de GitHub Actions](.github/workflows/tests.yml), que instala `mysql2`, levanta MySQL 8, inicializa las tablas y ejecuta las pruebas.
- [Evidencia histórica de v0.1.0](docs/pruebas/evidencia-ejecucion-2026-11-04.txt).

> MySQL se comprobó en el entorno aislado de GitHub Actions; **no** se ha probado en la computadora de la panadería ni realizado una aceptación formal con Ale Sánchez. Ver la [bitácora](docs/pruebas/registro-ejecuciones.md).

## Documentación del proyecto

- [Formato para incorporar recetas auténticas](docs/recetas/formato-recetas-reales.md).
- [ADR-001: aplicación web](docs/adr/ADR-001-aplicacion-web.md).
- [ADR-002: stack previsto](docs/adr/ADR-002-stack-y-persistencia.md).
- [ADR-003: JSON como solución inicial, ya superada](docs/adr/ADR-003-json-provisional.md).
- [ADR-004: MySQL y transacciones](docs/adr/ADR-004-mysql-transacciones-inventario.md).
- [ADR-005: importación privada de recetas](docs/adr/ADR-005-catalogo-privado.md).
- [Bloqueos](docs/seguimiento/bloqueos.md), [deudas técnicas](docs/seguimiento/deuda-tecnica.md), [Issues](https://github.com/paulinalizette70-boop/Paniko/issues).

## Equipo

- Paulina Lizette Villalpando Guizar — Product Owner.
- Saúl Emiliano Mora Famoso — Scrum Master.
- Gael Iosef Ramírez Marmolejo — Development Team.

**Uso:** prototipo universitario para pruebas y demostración. No cargues recetas confidenciales, datos reales de clientes ni secretos a un repositorio público sin autorización.

## Fórmulas privadas (v0.3.0)

El equipo decidió **no publicar recetas completas en GitHub**. El código incluye un importador a MySQL para el catálogo privado, con validaciones y pruebas sintéticas, pero **ninguna fórmula privada ni respaldo de la base**.

- [Instrucciones para importar desde un archivo local ignorado por Git](docs/recetas/importacion-privada.md).
- [ADR-005: decisión de privacidad y staging](docs/adr/ADR-005-catalogo-privado.md).
- [SQL de las tablas privadas vacías](sql/private-catalog.sql).
- [Tests unitarios del importador](tests/private-catalog.test.js).
- [Test de integración MySQL con datos falsos](tests/private-catalog-mysql.test.js).
