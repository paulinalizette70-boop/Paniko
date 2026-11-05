# ADR-002 — Tecnologías y persistencia previstas

- **Estado:** decisión registrada en el acta; implementación no verificada.
- **Referencia:** sección 4.3 del acta del proyecto.

## Contexto
Paniko debe manejar relaciones entre ingredientes, recetas, cantidades, costos y lotes.

## Decisión del acta
- Frontend: HTML, CSS y JavaScript.
- Backend: Node.js.
- Base de datos: MySQL.
- Autenticación: JWT.
- Hosting previsto: Vercel.

## Justificación
Estas opciones permiten una aplicación web y un modelo relacional para recetas e ingredientes.

## Consecuencias y riesgos
Verificar la compatibilidad del despliegue con Node.js y MySQL, el tratamiento correcto de unidades y la integridad de datos. Las credenciales deben permanecer fuera del repositorio público.

## Pendiente
Al subir el código, confirmar librerías, versiones y estructura real; registrar cambios mediante otro ADR si fuera necesario.
