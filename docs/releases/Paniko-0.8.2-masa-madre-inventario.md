# Paniko 0.8.2 · Masa madre vinculada a inventario

## Qué cambia

Se elimina la divergencia entre el registro de alimentaciones y el inventario operativo. Cada masa madre debe conectarse explícitamente a tres ingredientes **distintos** ya existentes en Ingredientes:

1. Masa madre (inventario en g o kg).
2. Harina de alimentación (g o kg).
3. Agua de alimentación (g, kg, ml o l; aplica equivalencia culinaria 1 ml ≈ 1 g solo al agua).

**Vincular no cambia existencias**: el peso de inventario del cultivo es la referencia al enlazar. Si difiere del valor del antiguo panel, la interfaz solicita confirmación, sin sobrescribir stock. Para ajustar el peso real utiliza el movimiento de ajuste físico de Ingredientes antes de conectar.

Al confirmar una alimentación, una única transacción MySQL realiza las salidas de harina y agua, registra el descarte de masa madre como salida y la nueva masa alimentada como entrada, guarda la alimentación y actualiza el peso. Si falta stock, hay un error o el peso cambió por otra producción, **ningún movimiento ni alimentación se confirma**.

El cultivo conectado consulta su peso **directamente del inventario**. Cuando una ficha técnica utiliza el mismo ingrediente de masa madre en una producción, el peso del panel refleja el consumo sin duplicarlo. Solo se admiten conversiones de unidad compatibles; no se inventan equivalencias para otros ingredientes.

## Compatibilidad e historial

- Alimentaciones históricas siguen conservadas. `sourdough_feedings.inventory_synced` distingue los registros posteriores, que modificaron inventario, de los anteriores, que no lo hicieron.
- La migración es aditiva e idempotente: columnas opcionales `starter_ingredient_id`, `flour_ingredient_id`, `water_ingredient_id` en `sourdough_starters` y `inventory_synced` en `sourdough_feedings`; llave única para evitar que dos cultivos representen el mismo stock, más claves externas a Ingredientes.
- No modifica recetas, contraseñas, costos, alimentaciones ni existencias existentes al migrar.
- La vinculación requiere sesión, no permisos financieros.
- No permite alimentar un cultivo sin vínculos, para que una alimentación nueva no quede fuera del inventario.

## Instalación y comprobación

Detener servidor, exportar la BD real desde MySQL Workbench y ejecutar el instalador `INSTALAR_PANIKO_082.ps1` sobre la instalación habitual. Acepta 0.8.0 y 0.8.1. Respalda archivos de código y migra MySQL después de confirmar. Si partes de 0.8.0 primero migra los rendimientos y calendario de 0.8.1.

Después de instalar, ejecutar `npm.cmd test`, arrancar `node --env-file=.env server.js`, abrir **Mi masa madre**, conectar los 3 ingredientes y probar primero con una alimentación pequeña real. Revisar en **Ingredientes** los movimientos de harina, agua y masa madre.

**Seguridad:** el instalador no exporta MySQL por sí mismo. Sin respaldo de la base no se debe ejecutar la migración real. Nunca incluir `.env`, `private/`, dumps, credenciales o fórmulas reales en GitHub.
