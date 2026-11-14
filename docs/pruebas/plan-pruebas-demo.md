# Plan de pruebas manuales para la demo de medio término

**Proyecto:** Paniko  
**Base de referencia:** versión **0.7.2 de `main`**  
**Estado de esta hoja:** plan preparado, **no** es una bitácora de ejecución. No marcar «Aprobado» hasta ejecutar cada caso.

Para estas pruebas usaremos datos **ficticios** y una base MySQL de demostración separada de la real. No debemos publicar credenciales, fórmulas, cantidades reales de recetas o información financiera de la panadería.

## Capturas recibidas: evidencia de interfaz, no de ejecución completa

El 13 de noviembre de 2026 se recibieron capturas de Paniko **local 0.8.3**. Se comprobó **visualmente** que existe una vista previa calculada para 15 baguettes, con indicador de capacidad de inventario y la leyenda «No se modificó el inventario». Esto **no corresponde** a ejecutar DM-05 ni DM-06: no hay evidencia de confirmar una tanda nueva ni de revisar su lote en el Historial. Ver [descripción de ocho vistas locales](../evidencias/capturas-local-083-2026-11-13.md). Hasta ejecutar los casos manuales, su estado sigue siendo **Pendiente**.

## Casos para ejecutar antes de la Sprint Review

| ID | Prueba y pasos principales | Resultado esperado | Ejecución |
| --- | --- | --- | --- |
| DM-01 | Iniciar sesión con cuenta de administración y entrar a Inicio | Abre la aplicación y muestra la navegación sin error | **Pendiente** |
| DM-02 | Abrir Ingredientes y registrar un ingrediente ficticio con unidad kg | El ingrediente aparece una sola vez y muestra la existencia capturada | **Pendiente** |
| DM-03 | Crear una ficha usando un ingrediente existente en kg con cantidad expresada en g | Se reconoce el mismo ingrediente y se convierte, sin duplicarlo ([Issue #11](https://github.com/paulinalizette70-boop/Paniko/issues/11)) | **Pendiente** |
| DM-04 | Con una receta ficticia de 10 piezas, calcular 20 piezas | Las cantidades son el doble y la vista previa no descuenta existencias | **Pendiente** |
| DM-05 | En base de pruebas, confirmar una producción con stock suficiente | Descuenta insumos una sola vez, registra tanda y no permite stock negativo | **Pendiente** |
| DM-06 | Abrir Historial y consultar la tanda ficticia anterior | Muestra el registro con su fecha y los insumos descontados | **Pendiente** |
| DM-07 | Consultar Productos y ventas con un producto ficticio y stock preparado | El movimiento registra las piezas vendidas y actualiza stock | **Pendiente** |
| DM-08 | Iniciar sesión como operador y tratar de abrir Finanzas y consultar la API financiera | No obtiene datos financieros; API devuelve 403 según el diseño de permisos | **Pendiente** |
| DM-09 | Con Agua registrada en litros, intentar crear una ficha ficticia con agua en gramos | Se utiliza la equivalencia específica de Agua y no se duplica el ingrediente ([Issue #12](https://github.com/paulinalizette70-boop/Paniko/issues/12)) | **Pendiente** |
| DM-10 | Intentar producir más piezas de las que permiten las existencias | Mensaje de inventario insuficiente, sin movimientos ni descuentos parciales | **Pendiente** |

## Datos de ejemplo, no recetas reales

En el repositorio existe `scripts/seed-demo.js`. Si se utiliza en una **base vacía y aislada**, crea una «Conchas de demostración (no receta real)» para 10 piezas, con «Harina de trigo (demo)» y «Azúcar (demo)».

En ese ejemplo, al pasar de 10 a 20 piezas se espera duplicar las cantidades (harina de 1 kg a 2 kg; azúcar de 0.25 kg a 0.5 kg). **No ejecutar el script sobre la base de la panadería**.

## Evidencias técnicas que ya existen

Las siguientes son pruebas **automatizadas**, no la ejecución de los diez casos manuales anteriores:

- [GitHub Actions aprobada en `main` después de integrar 0.7.2](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43374837592).
- [Pruebas de dominio y g/kg](../../tests/domain.test.js).
- [Pruebas de fichas importadas](../../tests/catalog-to-technical-sheet.test.js).
- [Pruebas de agua/huevo](../../tests/unit-conversions-egg-water.test.js).
- [Pruebas de seguridad y roles](../../tests/auth-security.test.js).
- [Pruebas de ventas y productos](../../tests/finished-products.test.js).
- [Pruebas de inventario y producción](../../tests/inventory.test.js).

**Las pruebas que requieren MySQL solo deben ejecutarse sobre una base terminada en `_test` con la configuración de prueba correspondiente.**

## Registro para completar durante el ensayo

Por cada caso anotar:

- **Fecha y hora:**
- **Versión y commit mostrado:**
- **Responsable que ejecutó la prueba:**
- **Resultado real:** aprobado / fallido / no ejecutado.
- **Evidencia:** ruta o enlace a captura sin datos privados.
- **Observaciones y enlace al Issue**, si aplica.

Si una prueba falla, la dejamos marcada como fallida y la documentamos. Es preferible enseñar un error identificado y su seguimiento que afirmar que toda la demo está libre de problemas sin haberla probado.
