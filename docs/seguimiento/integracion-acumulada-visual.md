# Integración acumulada de Paniko · revisión para una sola entrega

**Estado:** rama de trabajo, no versión instalada ni lista para producción.
**Base:** `main` (efad04045c9c).
**Código funcional:** rama `feat/paniko-masa-madre-visual` (a4049dc92a82).

## Funciones incluidas

- Edición de fichas técnicas y confirmación de preparaciones originales pendientes (0.7.3).
- Costos unitarios y precios de productos editables solo por administración (0.7.4).
- Ingresos, costos, gastos, resúmenes financieros y bitácora de masa madre (0.8.0).
- Calendario de pendientes y producciones; rendimientos en piezas, g o ml (0.8.1).
- Alimentación vinculada al inventario con movimientos transaccionales (0.8.2).
- Conteo físico de masa madre y conversión de leche líquida para brioche (0.8.3).
- Tarjeta visual de cultivos, horario de cuidados, acciones rápidas, historial y aviso en Inicio (posterior a 0.8.3).

Esta rama parte del `main` reciente y conserva su `README.md` y la documentación académica sin reemplazarlos con documentos antiguos. Los cambios anteriores siguen disponibles en sus PR originales como evidencia histórica.

## Condiciones antes de publicar o instalar

1. GitHub Actions: aprobar `npm test` con MySQL **aislado**.
2. Validar con datos sintéticos: permisos de operador/administración, alta y edición de recetas, leche en brioche, producción e inventario de masa madre, calendario, gastos y ventas.
3. Revisar e instalar migraciones en orden en un respaldo restaurado: costos de productos (0.7.4), finanzas y masa madre (0.8.0), calendario y rendimientos (0.8.1), y vinculación de masa madre (0.8.2). El panel visual no requiere migración.
4. Antes de migrar los datos reales, exportar un respaldo comprobable de MySQL y verificar la versión local exacta. Nunca ejecutar pruebas MySQL contra la base de trabajo.
5. No generar ZIP ni modificar el equipo local mientras no se apruebe una instalación conjunta.
6. Verificar manualmente el frasco y recordatorios (indicadores de **horario**, no de salud o actividad fermentativa medida), y que las acciones de inventario solo cambien existencias tras confirmación.
7. Mantener `.env`, `private/`, catálogos de recetas, información financiera y copias de bases de datos **fuera de GitHub**.

## Pendiente

- Validación en la instalación real de la panadería.
- Preparar **un solo actualizador** para la siguiente versión estable, respaldando MySQL y código; no entregar parches separados.
- Revisar y cerrar los PR históricos una vez aprobado este PR unificado, sin fusionarlos por separado.

**Decisión:** conservar este PR en borrador. No fusionar a `main` ni publicar una versión final hasta completar la validación anterior.
