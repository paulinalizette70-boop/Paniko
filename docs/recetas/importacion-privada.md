# Importación de recetas privadas a MySQL (Paniko v0.3.0)

**Las fórmulas privadas NO forman parte de este repositorio público.** El importador solamente incluye código y tablas vacías. No hay endpoints HTTP para leer las recetas almacenadas en estas tablas.

## Qué importa

- Fórmulas: ingredientes con cantidades originales, rangos, notas, estados, rendimientos y variantes.
- Productos: relación con su fórmula base y posibles preparaciones adicionales.
- Rellenos: separación de comerciales y elaborados.
- Avisos de validación: cantidades o rendimientos desconocidos y unidades no estandarizadas.

**Estado de implementación:** la importación se realiza en tablas de *staging* privadas (`private_catalog_*`), separadas del catálogo de recetas operativas y del inventario transaccional. Las fichas no se habilitan para producción hasta revisar rendimientos, unidades y acceso de usuarios. Así no se descuentan existencias usando cantidades ambiguas.

## Importar localmente (Windows PowerShell)

1. Instala Node.js 20+ y MySQL 8.0.16+ en tu equipo. Clona/descarga este repositorio.
2. En la carpeta de Paniko: `npm install`.
3. Crea un archivo `.env` en la raíz a partir de `.env.example` y completa `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` de tu instancia **privada**. No compartas `.env` ni contraseñas.
4. Configura esquema: `node --env-file=.env scripts/init-db.js`.
5. Crea la carpeta local `private` junto al README (está excluida de Git).
6. Copia **solo en tu computadora** el JSON privado recibido aparte, como `private/catalogo_recetas.json`.
7. Comprueba sin escribir: `npm run recipes:check -- --file private/catalogo_recetas.json`.
8. Importa a MySQL: `node --env-file=.env scripts/import-private-recipes.js --file private/catalogo_recetas.json --apply`.
9. Repetir la importación actualiza las claves existentes sin duplicarlas; **no borra** registros que ya estaban pero fueron retirados del JSON. Guarda respaldos antes de reemplazar datos.

## Comportamiento seguro

- No hay conexión a MySQL en modo de comprobación (sin `--apply`).
- El importador no muestra ingredientes, cantidades ni fórmulas en la consola; solo conteos y avisos.
- La escritura ocurre dentro de una transacción; si falla una sentencia, se revierte el lote.
- Las fórmulas no se suben por Git ni se envían a servicios de terceros por el importador.
- Las tablas privadas no se consultan desde `/api/recipes`: **no son visibles en la interfaz actual**.
- El acceso a la instancia MySQL debe mantenerse privado; el sistema todavía carece de autenticación y no debe exponerse a Internet.
- No subas archivos bajo `private/`, `.env`, respaldos SQL con datos ni capturas que muestren fórmulas reales.

## Datos pendientes

Algunas preparaciones y rendimientos requieren validación del equipo antes del costeo y descuento: faltan gramajes por pieza, densidades de cucharadas, rendimientos de cocciones, conversión de unidades y verificación de fórmulas propuestas. El importador **preserva estos datos sin inventar cantidades**.

## Evidencia académica 

- [Código de validación](../../src/private-catalog.js).
- [Código de importación transaccional](../../src/private-catalog-store.js).
- [Pruebas con datos ficticios](../../tests/private-catalog.test.js).
- [Prueba MySQL con datos ficticios](../../tests/private-catalog-mysql.test.js).
- [ADR-005](../adr/ADR-005-catalogo-privado.md).
- [Registro de ejecuciones](../pruebas/registro-ejecuciones.md).

Nunca publiques registros de la base MySQL que contengan los `raw_data` privados en GitHub.
