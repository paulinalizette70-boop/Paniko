# ADR-003 — Persistencia JSON temporal para un MVP ejecutable

**Fecha:** 4 de noviembre de 2026. **Estado:** implementado como decisión temporal del prototipo; requiere ratificación del equipo.

## Contexto
El acta de Paniko propone MySQL, pero el repositorio no tenía código fuente ni un entorno de base de datos configurado. Se necesitaba un prototipo reproducible para demostrar registros, fichas y escalado.

## Decisión
En la versión **0.1.0** usar un archivo JSON local (ignorado por Git) con Node.js para ingredientes y recetas, con pruebas de API usando almacenamiento temporal.

## Alternativas consideradas
- MySQL desde el inicio: alineado con el acta, pero exige configurar servidor, credenciales y esquema antes de demostrar el flujo.
- Datos solo en memoria: simple pero se pierden al reiniciar.
- JSON local: rápido para prototipo individual y persistente entre reinicios.

## Consecuencias
**Positivas:** arranque sin instalaciones adicionales, suite reproducible y cero secretos de base de datos.

**Negativas:** escritura síncrona, sin transacciones multiusuario ni garantías de concurrencia, sin autenticación, no apto para despliegue multiinstancia. No equivale a implementar MySQL.

## Seguimiento
Migrar a MySQL antes de considerar el sistema listo para producción; documentar esquema, migración y tests de integridad. Consultar el Issue de deuda técnica correspondiente.
