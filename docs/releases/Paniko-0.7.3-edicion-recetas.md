# Paniko 0.7.3 — Edición de fichas y recetas pendientes

Problema resuelto: las fichas productivas anteriores y las recetas originales pendientes estaban en modo de solo lectura.

El personal con sesión iniciada puede ahora editar fichas escalables existentes sin modificar inventarios ni producciones históricas. También puede guardar borradores del catálogo original, corregir ingredientes y confirmar cuando sean válidos. Se respeta el modelo de roles: solo Administración consulta la gestión financiera.

API: `POST /api/recipes/:id/update` y `POST /api/catalog/recipes/:id/save`, ambas requieren sesión. Una nueva importación del catálogo no sobrescribe datos editados manualmente. Se sigue utilizando la base MySQL existente sin migraciones.

Los datos originales siguen locales. Las pruebas utilizan únicamente recetas sintéticas.
