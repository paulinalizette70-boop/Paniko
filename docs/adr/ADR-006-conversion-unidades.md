# ADR-006 — Conversión de unidades en fichas e inventario

**Fecha:** noviembre de 2026. **Estado:** implementada en código; ver resultados de GitHub Actions.

## Contexto
La panadería puede comprar harina en kg y medirla en g para una fórmula, o almacenar agua en litros y usar ml. Anteriormente el sistema exigía que la receta usara exactamente la misma unidad que el ingrediente.

## Decisión
1. Agregar el campo opcional `unit` al renglón de receta y a las entradas de inventario. La ausencia mantiene compatibilidad con registros anteriores.
2. Convertir solamente `g ↔ kg` y `ml ↔ l`, conservando `pieza` como unidad independiente.
3. Normalizar las cantidades **antes de almacenarlas** en la unidad del ingrediente; el esquema MySQL permanece igual. Costos, escalado y consumos utilizan esa unidad.
4. Rechazar unidades incompatibles y conversiones cuya cantidad normalizada exceda seis decimales, para evitar pérdidas silenciosas de inventario.
5. No inferir densidades ni equivalencias entre piezas y peso.

## Alternativas
- Obligar a usar una única unidad: alto riesgo de captura humana.
- Almacenar dos unidades por línea: requiere cambio de esquema y más complejidad.
- Normalizar en el backend: elegida por compatibilidad y consistencia.

## Consecuencias
No se cambian los registros existentes. La unidad original tecleada no queda almacenada, únicamente su equivalente en la unidad de inventario. Las fórmulas reales siguen privadas y fuera del repositorio.

## Verificación
[Pruebas unitarias](../../tests/domain.test.js), [de inventario](../../tests/inventory.test.js) y [de integración MySQL](../../tests/mysql.test.js).
