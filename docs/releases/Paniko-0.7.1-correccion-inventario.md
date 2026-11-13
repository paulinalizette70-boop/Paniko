# Paniko 0.7.1 — Corrección de compatibilidad de inventario

## Síntoma confirmado
Tras instalar el paquete 0.7.1 sobre `D:\Paniko-main\Paniko-main` (base local 0.6.0), tres tests de inventario fallaron:
- `INV-01`: `TypeError: stockExit is not a function`.
- `INV-02`: `TypeError: stockAdjustment is not a function`.
- `INV-03`: estado HTTP 500 al intentar un ajuste que debía dar HTTP 200.

## Causa
El instalador de 0.7.1 no incluía el archivo `src/inventory.js`; en la instalación local permaneció el de 0.6.0, cuyo `module.exports` no contiene `stockExit` ni `stockAdjustment`.

## Corrección
Instalar **solo** `src/inventory.js` desde la rama de integración, preservando y respaldando el antiguo. Blob verificado en GitHub: `3ad00b32c0cf7a467f3fde23e70ac091865a349f`. SHA-256: `67e2daa41336cb699916d1ac287fa5a96dcfbd6a3ab21aab24d4031603fb4670`.

No se necesitan migraciones ni cambios de `.env`, MySQL, `private/`, recetas ni productos.

## Verificación
Se reprodujeron localmente los tres fallos sobre el árbol 0.7.1 sustituyendo `src/inventory.js` por el original de 0.6.0, y quedaron corregidos reemplazándolo por el archivo publicado en GitHub. Resultado con el archivo correcto: 52 pruebas aprobadas, 0 fallidas, 5 omitidas en el entorno de validación.

Para comprobar en Windows:
```powershell
cd 'D:\Paniko-main\Paniko-main'
node -p "require('./package.json').version"
npm.cmd test
```
El programa debe seguir en 0.7.1. Antes de abrir el servidor, cerrar el anterior con `Ctrl+C`.

## Prevención
Todo instalador de Paniko posterior que acepte la versión local 0.6.0 como origen debe actualizar `src/inventory.js` junto a `src/store.js` y `src/mysql-store.js`. Validar una instalación sobre copia de 0.6.0 y ejecutar `npm.cmd test`.
