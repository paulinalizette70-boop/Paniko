# Paniko · Gestión de producción para panaderías artesanales

Proyecto universitario de **Seminario de Integración: Desarrollo** — Universidad de Guadalajara, Centro Universitario de Tlaquepaque.

> **Estado:** MVP académico **v0.1.0** construido el 4 de noviembre de 2026. Incluye operaciones básicas y no representa todavía todo el alcance del acta de proyecto.

## Propósito

Evitar errores en el registro manual de insumos y recetas, facilitar el cálculo de cantidades de producción y ofrecer un primer estimado de costos y disponibilidad de inventario.

## Funcionalidades implementadas en este MVP

- **Registro de ingredientes:** nombre, unidad (g, kg, ml, l, pieza), costo por unidad y existencia, con validaciones.
- **Fichas técnicas:** recetas con rendimiento base y lista de ingredientes y cantidades.
- **Consulta:** listados de ingredientes y recetas registradas.
- **Escalado de vista previa:** calcula cantidades, costo estimado y alerta de inventario insuficiente. **No descuenta stock** ni inicia/cierra lotes.
- Persistencia local provisional en un archivo JSON (se crea al ejecutar), excluido de Git.

## Pendiente del alcance original

Migración a MySQL, autenticación y roles, transacciones de inventario, lotes y mermas, dashboard, despliegue público y validación con la dueña. **Nada de ello está declarado como implementado.**

## Requisitos

- [Node.js](https://nodejs.org/) versión **20 o superior**.
- Navegador web moderno.
- **No requiere `npm install`**: esta versión usa módulos integrados de Node.js.

## Ejecutar localmente

1. Descargar/clonar el repositorio.
2. Abrir una terminal dentro de la carpeta `Paniko`.
3. Ejecutar `npm start`.
4. Abrir **http://localhost:3000**.
5. Registrar ingredientes y crear una ficha técnica, o ejecutar `npm run seed` en otra terminal para cargar el ejemplo de conchas. La carga de ejemplo no modifica un archivo que ya tenga registros.

**Opcional:** configurar `PORT` o `DATA_FILE` como variables de entorno. La aplicación guarda datos en `data/paniko.json`, ignorado por Git.

## Datos para demostrar

`npm run seed` carga dos ingredientes ficticios: harina de trigo 5 kg a $25/kg y azúcar 2 kg a $30/kg, y una receta de 10 conchas con 1 kg de harina y 0.25 kg de azúcar. Al escalar a 20 piezas se requieren 2 kg y 0.5 kg, con costo estimado de **$65 MXN**. Son **datos de demostración, no de Casa Dely**.

## Ejecutar pruebas realizadas

```bash
npm test
```

Se ejecutaron **9 pruebas automatizadas** (8 unitarias y una prueba de integración de API con varios escenarios) en Node.js 22.16.0, con **9 aprobadas y 0 fallidas** en el entorno local de desarrollo.

- [Catálogo y resultados](docs/pruebas/casos-de-prueba.md).
- [Bitácora de ejecución](docs/pruebas/registro-ejecuciones.md).
- [Salida de la ejecución](docs/pruebas/evidencia-ejecucion-2026-11-04.txt).
- [Código de pruebas unitarias](tests/domain.test.js).
- [Código de prueba de integración](tests/integration.test.js).
- [GitHub Actions](.github/workflows/tests.yml) — [ejecución remota verificada: completada correctamente](https://github.com/paulinalizette70-boop/Paniko/actions/runs/41957663860).

## Arquitectura

- Frontend: HTML, CSS y JavaScript, servido por Node.js.
- Backend: Node.js y API HTTP nativa, sin dependencias externas.
- Persistencia: JSON local provisional, **no MySQL aún** (consultar ADR-003).
- Entradas: `server.js`; negocio: `src/domain.js`; datos: `src/store.js`; API: `src/app.js`.

### Decisiones (ADR)

- [ADR-001: aplicación web](docs/adr/ADR-001-aplicacion-web.md).
- [ADR-002: tecnologías previstas en el acta](docs/adr/ADR-002-stack-y-persistencia.md).
- [ADR-003: almacenamiento JSON temporal](docs/adr/ADR-003-json-provisional.md).

## Seguimiento de riesgos y tareas

- [Bloqueos](docs/seguimiento/bloqueos.md).
- [Deudas técnicas](docs/seguimiento/deuda-tecnica.md).
- [Issues de GitHub](https://github.com/paulinalizette70-boop/Paniko/issues).

## Equipo

- Paulina Lizette Villalpando Guizar — Product Owner.
- Saúl Emiliano Mora Famoso — Scrum Master.
- Gael Iosef Ramírez Marmolejo — Development Team.

> Este repositorio contiene un prototipo académico inicial y pruebas técnicas. La aceptación por stakeholders reales aún está pendiente. No se almacenan credenciales reales ni datos personales de clientes.
