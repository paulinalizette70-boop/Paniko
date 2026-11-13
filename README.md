# Paniko · Gestión de panadería artesanal

**MVP académico | Versión de integración 0.7.2 | Seminario de Integración: Desarrollo**

**Universidad de Guadalajara · Centro Universitario de Tlaquepaque · Ingeniería Informática**

Paniko es una aplicación web para organizar el trabajo diario de una panadería artesanal. Reúne **ingredientes, inventario, recetas y fichas técnicas, escalado de preparaciones, producción, productos terminados, ventas e historial**. Busca sustituir registros dispersos por un flujo sencillo y trazable.

> **Estado de publicación:** la versión 0.7.2 está en la rama [de integración](https://github.com/paulinalizette70-boop/Paniko/tree/integracion/paniko-0.6.1-20261111-1923) y en el [Pull Request #9](https://github.com/paulinalizette70-boop/Paniko/pull/9). La rama `main` conserva la versión 0.4.0 hasta revisar y fusionar el PR. Paniko es un prototipo académico de uso local; no se recomienda desplegarlo públicamente sin una revisión de seguridad.

## Índice

- [Objetivo y alcance](#objetivo-y-alcance)
- [Funcionalidades](#funcionalidades)
- [Tecnologías y arquitectura](#tecnologías-y-arquitectura)
- [Instalación y configuración](#instalación-y-configuración)
- [Cómo utilizar Paniko](#cómo-utilizar-paniko)
- [Pruebas y evidencias](#pruebas-y-evidencias)
- [Capturas de pantalla](#capturas-de-pantalla)
- [Evaluación con usuaria real](#evaluación-con-usuaria-real)
- [Backlog y trabajo pendiente](#backlog-y-trabajo-pendiente)
- [Organización y contribuciones](#organización-y-contribuciones)
- [Privacidad, seguridad y licencia](#privacidad-seguridad-y-licencia)

## Objetivo y alcance

**Objetivo general:** facilitar el control de insumos y preparaciones de una panadería artesanal, permitiendo calcular cantidades según la producción deseada y conservar el registro de sus movimientos.

En esta etapa, la prioridad del MVP es el **inventario y su relación con las recetas y la producción**. La aplicación tiene módulos adicionales en desarrollo; se diferencian abajo las funciones implementadas de las mejoras pendientes.

## Funcionalidades

| Módulo | Función disponible en la rama 0.7.1 |
| --- | --- |
| Inicio de sesión y roles | Sesiones de administración y operador; cierre de sesión y autorización de rutas |
| Inicio | Resumen operativo y accesos directos a las tareas comunes |
| Ingredientes | Registro, existencias, entradas, salidas manuales y ajustes por conteo físico |
| Recetas y fichas técnicas | Registro de fichas, consulta de fórmulas del catálogo local por personas autenticadas y generación de fichas escalables cuando los datos son completos |
| Escalado | Cálculo de cantidades, costos estimados según permisos, faltantes y capacidad máxima conservadora |
| Producción | Confirmación de tandas con verificación y descuento transaccional de ingredientes |
| Productos y ventas | Catálogo de productos terminados, existencias, ventas, ajustes y movimientos de merma |
| Historial | Consulta de movimientos y lotes de producción con sus consumos |
| Finanzas | Acceso restringido a administración para consultar costos, valoración y gestionar precios |

**Reglas relevantes:**

- Las recetas son accesibles **dentro de la aplicación** a las personas con cuenta; las fórmulas reales **no se publican en GitHub**.
- La gestión financiera y las operaciones relacionadas con costos y precios están restringidas al perfil de administración, tanto en la interfaz como en la API.
- La aplicación admite cantidades en **g/kg** y **ml/l** para la misma magnitud. No transforma unidades incompatibles ni inventa equivalencias de cucharadas a gramos.
- La vista previa de producción no descuenta inventario; el servidor comprueba las existencias de nuevo cuando se confirma una tanda.
- El resumen financiero **semanal** solicitado por la usuaria todavía **no está implementado**: véase la [historia HU-11](https://github.com/paulinalizette70-boop/Paniko/issues/10).

## Tecnologías y arquitectura

| Capa | Tecnología |
| --- | --- |
| Interfaz | HTML5, CSS3 y JavaScript |
| Servidor y API | Node.js, módulo HTTP nativo |
| Datos | MySQL 8, tablas relacionales y transacciones InnoDB |
| Acceso a MySQL | `mysql2` |
| Pruebas | `node:test` y `node:assert` |
| Integración continua | GitHub Actions con servicio MySQL aislado |
| Control de versiones | Git y GitHub mediante ramas y Pull Requests |

**Organización del proyecto:**

```text
Paniko/
├── .github/workflows/     # Pruebas automáticas
├── docs/                  # ADRs, pruebas, releases y seguimiento
├── public/                # Interfaz web
├── scripts/               # Inicio de BD, admin e importación local
├── sql/                   # Esquemas y tablas
├── src/                   # Dominio, autenticación, API y persistencia
├── tests/                 # Pruebas unitarias e integración
├── .env.example           # Ejemplo de configuración, sin secretos
├── package.json
└── server.js
```

Las fórmulas operativas guardadas localmente pueden provenir de un catálogo de importación. Las tablas históricas `private_catalog_*` conservan ese nombre por compatibilidad, pero el acceso a las recetas dentro de Paniko se rige por la sesión del usuario.

## Instalación y configuración

### Requisitos

- **Node.js 20 o superior** (se recomienda Node.js 22).
- **MySQL 8** instalado y funcionando.
- Navegador actualizado.
- Git para descargar la rama directamente (opcional si se dispone de un paquete revisado).

### 1. Descargar la versión de integración

En PowerShell:

```powershell
git clone --branch integracion/paniko-0.6.1-20261111-1923 https://github.com/paulinalizette70-boop/Paniko.git
cd Paniko
npm.cmd install
```

Si ya tienes una instalación local con datos reales, **no sustituyas su carpeta directamente**. Realiza un respaldo y verifica primero los cambios en una copia con una base de pruebas.

### 2. Configurar MySQL

Crea una base de datos de desarrollo (por ejemplo, `paniko`) y un usuario con permisos adecuados sobre ella. Copia `.env.example` a `.env` y configura allí `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`. La conexión no debe incluirse en commits ni capturas.

```powershell
Copy-Item .env.example .env
# Edita .env con tus propios valores; no publiques el archivo.
node --env-file=.env scripts/init-db.js
```

**Importante:** inicializa el esquema solo en un entorno autorizado. Si la base ya contiene información, respáldala antes de cualquier cambio.

### 3. Crear cuenta de administración

Ejecuta este comando en una consola interactiva. La contraseña se solicita durante la ejecución y no debe aparecer en GitHub.

```powershell
node --env-file=.env scripts/create-admin.js
```

### 4. Iniciar Paniko

```powershell
node --env-file=.env server.js
```

Abre **http://127.0.0.1:3000** (o el puerto configurado en `.env`) e inicia sesión.

**Nota para Windows:** usamos `npm.cmd` para evitar el bloqueo de ejecución del script `npm.ps1` en algunas instalaciones de PowerShell.

### Si vienes de una instalación 0.6.0

Una versión anterior del actualizador 0.7.1 omitía el archivo `src/inventory.js`, ocasionando errores `stockExit is not a function` y `stockAdjustment is not a function` en ciertas instalaciones. **No uses a ciegas ese actualizador** sobre tu sistema en uso. Consulta [la nota de corrección de inventario](docs/releases/Paniko-0.7.1-correccion-inventario.md), conserva `.env`, `private/` y la base de datos, y verifica las pruebas antes de registrar movimientos reales.

## Cómo utilizar Paniko

Un flujo habitual, preferentemente con **datos ficticios para la demo**, consiste en:

1. **Ingredientes:** registrar harina, azúcar u otros insumos y sus existencias.
2. **Recetas:** crear una ficha técnica, o generar una ficha a partir de una fórmula local completa y confirmada.
3. **Producción:** seleccionar la receta y el número de piezas que se desea preparar.
4. **Vista previa:** comprobar cantidades, unidades, faltantes y límite según inventario.
5. **Confirmar producción:** registrar el consumo de insumos y, si corresponde, las existencias de producto terminado.
6. **Productos y ventas:** registrar ventas y consultar su movimiento.
7. **Historial:** verificar los lotes y cambios de existencias.

**Ejemplo ficticio de conversión:** si la harina se almacena en `kg` y una ficha utiliza `500 g`, la cantidad equivalente es `0.5 kg`. El sistema debe reutilizar el ingrediente existente, no duplicarlo. Esta operación cuenta con pruebas técnicas, pero el flujo de creación de fichas debe validarse en la interfaz actual debido a la [incidencia #11](https://github.com/paulinalizette70-boop/Paniko/issues/11).

## Pruebas y evidencias

La suite está en [`tests/`](tests/) y se ejecuta mediante:

```powershell
npm.cmd test
```

Incluye pruebas de dominio, validación de fichas, conversiones, inventario, autenticación/roles, productos, historial e integración. Los casos con MySQL deben utilizar **exclusivamente** una base aislada cuyo nombre termine en `_test`; nunca ejecutar las pruebas de integración contra datos reales.

**Evidencias verificables:**

- [Workflow de GitHub Actions](.github/workflows/tests.yml) (Node.js y MySQL aislado).
- [Ejecución aprobada de Paniko 0.7.1](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43344993724).
- [Catálogo de casos de prueba](docs/pruebas/casos-de-prueba.md).
- [Bitácora de pruebas y evaluación](docs/pruebas/registro-ejecuciones.md).
- [Pull Request de integración #9](https://github.com/paulinalizette70-boop/Paniko/pull/9).

Las pruebas automatizadas comprueban el comportamiento técnico bajo las condiciones de prueba. **No equivalen a la aceptación de la versión 0.7.1 por parte de la panadería.**

## Capturas de pantalla

**Pendiente:** incorporar capturas reales de la versión 0.7.1, tomadas con una cuenta de demostración y datos ficticios. No hay imágenes publicadas aún y, por ello, este README no muestra capturas inexistentes.

| Captura requerida | Qué debe mostrar |
| --- | --- |
| Inicio | Distribución de la nueva interfaz y accesos directos |
| Ingredientes | Existencias y registro de movimientos |
| Recetas | Ficha técnica y selección de unidades |
| Producción | Escalado, vista previa y confirmación |
| Productos y ventas | Registro de ventas y productos terminados |
| Historial | Movimientos o detalle de un lote |
| Finanzas | Solo con datos ficticios, desde la cuenta administradora |

## Evaluación con usuaria real

La responsable de la panadería, **Ale Sánchez**, utilizó **Paniko v0.4** durante **tres días dentro del periodo del 4 al 7 de noviembre de 2026**. La retroalimentación reportada fue:

- **Utilidad:** el sistema le ayudó durante el periodo de prueba.
- **Usabilidad:** concentrar toda la información en una sola pantalla le resultó confuso.
- **Creación de fichas:** encontró dificultades al trabajar con el mismo ingrediente expresado en gramos y kilogramos.
- **Necesidad de negocio:** solicitó visualizar semanalmente ventas, ganancias, inversión y pérdidas.

Estos comentarios orientaron el rediseño de navegación y las prioridades del backlog. **Ale evaluó la versión 0.4, no la 0.7.1; esta última todavía requiere revalidación con la usuaria.**

- [Informe de evaluación con Ale](docs/seguimiento/evaluacion-usuaria-ale-v04.md).
- [Retrospectiva del medio término](docs/seguimiento/retrospectiva-medio-termino.md).

## Backlog y trabajo pendiente

| Prioridad | Pendiente | Seguimiento |
| --- | --- | --- |
| Alta | Validar el flujo de **crear fichas** cuando inventario y receta usan g/kg | [Issue #11](https://github.com/paulinalizette70-boop/Paniko/issues/11) |
| Alta | Definir y desarrollar el **resumen financiero semanal** exclusivo para administración | [HU-11 / Issue #10](https://github.com/paulinalizette70-boop/Paniko/issues/10) |
| Alta | Probar v0.7.1 en la instalación local, revisar el PR #9 y fusionar a `main` | [PR #9](https://github.com/paulinalizette70-boop/Paniko/pull/9) |
| Media | Actualizar incidencias históricas y documentar pendientes reales de producción/cierre | [Issues](https://github.com/paulinalizette70-boop/Paniko/issues) |
| Media | Añadir capturas auténticas, evidencia individual y revisión formal del equipo | [Entrega GitHub](docs/entrega-github.md) |

## Organización y contribuciones

**Equipo académico:** Paulina Lizette Villalpando Guizar, Saúl Emiliano Mora Famoso y Gael Iosef Ramírez Marmolejo.

La participación y las aportaciones individuales deben respaldarse con commits, PRs y evidencias concretas; los nombres del equipo no implican que todas las tareas hayan sido ejecutadas por todas las personas.

**Flujo recomendado de trabajo:**

1. Registrar una historia, error o tarea en GitHub Issues.
2. Crear una rama descriptiva a partir de la rama de desarrollo correspondiente.
3. Implementar el cambio usando **datos ficticios** y agregar las pruebas pertinentes.
4. Ejecutar `npm.cmd test` y verificar GitHub Actions.
5. Abrir un Pull Request que explique el objetivo, los archivos modificados, las pruebas y los riesgos.
6. Solicitar revisión a otra persona, responder comentarios y documentar la aprobación.
7. Fusionar solo cuando las pruebas y la revisión estén completas; mantener `main` estable.

El [PR #9](https://github.com/paulinalizette70-boop/Paniko/pull/9) sigue abierto para revisar la integración de v0.7.1. Las revisiones formales y la fusión permanecen pendientes.

**Documentación técnica:** [ADRs](docs/adr/), [bloqueos](docs/seguimiento/bloqueos.md), [deuda técnica](docs/seguimiento/deuda-tecnica.md) y [guía de entrega](docs/entrega-github.md).

## Privacidad, seguridad y licencia

- El repositorio es **público** para el código, pero las recetas reales y los datos financieros del negocio **no son públicos**. No subir `.env`, `private/`, bases de datos, respaldos, credenciales ni fórmulas reales.
- La visibilidad de las recetas **dentro** de Paniko no autoriza a compartirlas **fuera** de la aplicación.
- No publicar capturas que expongan datos de la panadería o sesiones autenticadas.
- El proyecto se destina a desarrollo académico y pruebas locales. El uso real exige respaldos y validación adicional de permisos y seguridad.
- **Licencia actual:** `UNLICENSED` en `package.json`. No se ha elegido ni añadido una licencia de software libre; el equipo debe decidir las condiciones de redistribución antes de presentar una licencia distinta. Que el código sea visible en GitHub **no** significa que las recetas o fórmulas del negocio puedan reutilizarse libremente.

---

**Paniko · Hecho para organizar una panadería artesanal, una preparación a la vez.**

## Actualización 0.7.2: equivalencias y porcentaje panadero

- Se adopta la equivalencia solicitada de **1 huevo = 50 g sin cáscara**. Para Agua, **1 ml ≈ 1 g**. Estas conversiones solo se aplican a Agua/Huevo y a unidades de masa y volumen compatibles; no se inventan densidades de otros ingredientes.
- Las fichas técnicas se pueden crear con existencias cero. Se reutilizan los ingredientes que ya existen y se crean los que faltan con stock y costo cero. Las existencias solo se comprueban cuando se desea producir.
- El **porcentaje panadero** toma como 100 % la suma de todas las harinas de la ficha; calcula el peso de cada ingrediente respecto de esa base. Si no hay harina o no existe equivalencia de peso, muestra una advertencia en vez de un porcentaje arbitrario.
- Disponible en Recetas > Ver % panadero, en el formulario > Calcular % panadero antes de guardar, y en Producción > Ver porcentajes panaderos después de la vista previa.
- Nuevas rutas autenticadas GET /api/recipes/:id/bakers y POST /api/recipes/bakers-preview. No modifican inventarios ni contienen datos financieros para operadores.
- No modifica tablas SQL ni configuraciones .env. El instalador 0.7.2 también actualiza src/inventory.js, preservando la corrección del error de inventario de 0.7.1.
