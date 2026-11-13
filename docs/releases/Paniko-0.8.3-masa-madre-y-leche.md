# Paniko 0.8.3 · Sincronización de masa madre y conversión de leche

## Por qué se hizo

Un cultivo de masa madre podía quedar vinculado a un ingrediente cuyo stock era cero. Vincular no actualizaba Inventario; además, la versión 0.8.2 sustituía el peso de la bitácora por el existente al enlazar. En esos casos, para reconciliar masa madre real con Inventario había que salir del módulo y ajustar manualmente el ingrediente. Otra incidencia era que el brioche podía fallar si se anotaba leche en gramos mientras el ingrediente estaba registrado en litros.

## Nueva gestión de masa madre

- Al **conectar por primera vez**, elegir entre **conservar la existencia actual de Inventario (predeterminado)** o **sincronizar Inventario con el peso ya anotado en la masa madre**. La segunda opción exige confirmación y registra un movimiento de entrada o salida auditado en `inventory_movements`; **no registra una alimentación**, ni consume harina o agua.
- Para una masa madre **ya conectada**, la acción **Corregir existencias (conteo físico)** permite pesar la masa madre, escribir los gramos realmente disponibles y ajustar ese ingrediente del inventario, con motivo auditado. Esta acción resuelve específicamente los vínculos antiguos que quedaron en 0 g.
- Un cambio inesperado en las existencias entre abrir la pantalla y guardar da error de conflicto (409) y no produce movimientos.
- Las alimentaciones siguen siendo transaccionales y descuentan harina y agua; el cultivo se incrementa de acuerdo con el descarte y la alimentación. Los movimientos anteriores no se modifican retroactivamente.
- El módulo muestra por nombre y cantidad los tres ingredientes vinculados (masa madre, harina y agua). El ajuste de conteo físico no modifica los otros dos.

## Conversiones de leche líquida

- Para **leche líquida de vaca** (por ejemplo, leche, leche entera, fresca, pasteurizada), usa la equivalencia culinaria aproximada **1 ml ≈ 1.03 g**. Permite g↔kg↔ml↔l, redondeando conversiones a seis decimales para guardarlas en MySQL.
- La densidad es una estimación general; las marcas o temperaturas pueden variar. Si un proceso necesita precisión, **medir directamente el peso** y registrar el ingrediente de forma consistente en masa. No se aplica a leche en polvo, condensada ni evaporada, ni a aceite, miel u otros líquidos con densidades distintas.
- La conversión se aplica a crear/editar fichas, convertir desde el catálogo original, entradas y salidas y cálculos panaderos cuando corresponda. No modifica existencias al crear fichas.

## Instalación y validación

No hay cambios de tablas ni migraciones en esta versión. Se requiere **Paniko 0.8.2**. Cerrar el servidor, ejecutar `INSTALAR_PANIKO_083.ps1`, verificar `npm.cmd test` e iniciar con `node --env-file=.env server.js`. El instalador conserva `.env`, `private/`, `data/`, `node_modules/` y **toda la información de MySQL**, y respalda el código que reemplaza. Es recomendable exportar la base desde MySQL Workbench antes de hacer un conteo físico real.

Las pruebas con MySQL solo deben ejecutarse sobre una base aislada cuyo nombre termine en `_test` (variable `MYSQL_TEST=1` en CI), nunca en la base de la panadería.
