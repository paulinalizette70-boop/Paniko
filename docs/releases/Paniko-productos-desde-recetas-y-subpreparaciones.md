# Crear productos desde recetas base y producir subpreparaciones

**Estado:** desarrollo para validación, sin instalar en la base de la panadería. Rama derivada de la mejora de brioche.

## Necesidad y nuevo flujo

La usuaria quiere trabajar desde una sola receta de **masa brioche**. Al abrir su ficha en **Recetas** verá el botón **«Crear productos desde esta receta»**. El botón abre **Producción**, ya con esa masa seleccionada. No se añade ninguna sección lateral.

Dentro del panel **Producción por formatos**, administración puede:

1. Configurar una vez los gramos reales que rinde la masa completa.
2. Crear directamente *Concha de brioche*, *Bollo de hamburguesa* o *Bun relleno*, indicando nombre, gramos de masa por pieza y complementos (en gramos/ml u otras unidades compatibles).
3. Editar el formato de un producto ya existente sin duplicar productos ni fórmulas.
4. Producir varios formatos desde un mismo amasado, tras una vista previa y una confirmación explícita.

## Cómo aparecen la costra y la mermelada como complemento

En **Producción → Costras, mermeladas y otras subpreparaciones**:

1. Registrar una ficha técnica que tenga rendimiento en **g** o **ml** (por ejemplo, *Costra de concha*, rendimiento 600 g).
2. Usar **Vincular receta como subpreparación**. Paniko crea automáticamente una existencia vacía de **Preparación: Costra de concha**, o vincula un ingrediente ya existente si la usuaria lo selecciona. **Vincular no produce ni descuenta inventario.**
3. Cuando la costra esté realmente preparada, indicar cuántos gramos se obtuvieron, revisar el consumo y pulsar **Confirmar preparación y actualizar inventario**.
4. En una transacción MySQL se descuentan los materiales de la costra, se crea un lote con historial de costos y movimientos, y se añade la cantidad de costra obtenida a inventario.
5. Al registrar conchas como producto del brioche, Paniko descuenta solo la cantidad de costra **ya preparada**: no vuelve a descontar la mantequilla, azúcar u otros ingredientes usados para fabricar esa costra.

Si la ficha *Costra de concha* actualmente rinde piezas, se debe editar para registrar el rendimiento real en gramos. Paniko no inventa la equivalencia.

La preparación puede registrarse también sin producto brioche: costra, crumble, mermeladas y frangipane comparten este esquema.

## Seguridad

- Administración: configurar recetas base, crear productos, vincular preparaciones.
- Personal autenticado: calcular y registrar lotes de producción.
- Las existencias no cambian en configuraciones ni vistas previas.
- **Se bloquea** la confirmación tradicional de una receta vinculada como subpreparación porque esta vía antigua solo descontaba ingredientes, no añadía el rendimiento preparado.
- Una transacción MySQL registra insumos consumidos, lote, movimientos y existencia preparada. Falta de existencias o fallo en cualquier paso implica rollback.
- Costo de preparaciones calculado por promedio ponderado (aproximado; se redondea a 4 decimales); información financiera filtrada para operadores.
- Nunca subir `.env`, `private/`, fórmulas reales, credenciales o inventario al repositorio.
- Se requiere la migración de formatos de brioche **antes** de usar esta mejora.
- Migración adicional **aditiva e idempotente**: `node --env-file=.env scripts/migrate-dough-preparations.js --apply --confirm-backup`. Solo crea `dough_prepared_recipes` con sus referencias; no reescribe existencias.

## Validaciones antes de instalar en panadería

- Pruebas `npm test` en GitHub Actions con servicio MySQL `paniko_test`.
- Confirmar productos nuevos con gramajes auténticos y preparaciones existentes en la panadería.
- Respaldar **MySQL y código** antes de migrar, verificar el respaldo y usar una actualización por PowerShell sin ZIP.
- Aplicar la migración solo después de confirmar el respaldo.
- Evaluar un lote ficticio en instalación de prueba antes de la primera confirmación real.
- Continuar los lotes históricos y recetas privadas sin cambios.

**No fusionar en `main` ni modificar la base real hasta validar la interfaz y la migración con datos ficticios.**
