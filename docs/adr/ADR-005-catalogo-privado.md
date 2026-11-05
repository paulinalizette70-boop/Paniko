# ADR-005 — Importación de fórmulas privadas a tablas de staging MySQL

**Fecha:** noviembre de 2026. **Estado:** implementado y sujeto a revisión de acceso/uso operativo.

## Contexto

La Product Owner indicó que las fórmulas de panadería deben mantenerse **privadas**. GitHub es público y el MVP no tiene inicio de sesión ni perfiles de acceso. Parte de los datos de recetas son provisionales (rendimientos, gramajes, unidades) y no deben alimentar automáticamente movimientos de inventario.

## Decisión

1. Mantener los datos reales en un JSON **local ignorado por Git**, distribuido a la Product Owner fuera del repositorio.
2. Permitir una verificación local sin conexión a base de datos y exigir `--apply` para escribir.
3. Importar atómicamente a tablas MySQL `private_catalog_recipes`, `private_catalog_products`, `private_catalog_fillings` y `private_catalog_imports` con parámetros.
4. Guardar el JSON original de cada entidad y sus estados, sin conversiones de unidades inventadas y sin duplicar registros en importaciones sucesivas.
5. **No agregar endpoints públicos para estas tablas**; distinguir staging de recetas operativas.
6. Ejecutar pruebas automáticas exclusivamente con datos sintéticos en MySQL aislado.

## Alternativas consideradas

- Publicar las fórmulas como ejemplos en GitHub: **rechazada por privacidad**.
- Insertarlas directamente como recetas operativas: **rechazada por falta de validación de unidades y rendimiento**.
- Importación privada en staging con validación: **elegida**.

## Consecuencias

El usuario debe configurar una base MySQL propia; no existe importación remota desde el chat al servidor personal. La importación conserva toda la información pero **no hace disponibles las recetas en el panel web** hasta que se implemente acceso autenticado y una transición validada al catálogo operativo. Revisar credenciales y copias de respaldo del servidor de base de datos.
