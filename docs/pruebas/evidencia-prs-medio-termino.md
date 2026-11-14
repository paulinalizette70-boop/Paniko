# Evidencia de Pull Requests y colaboración — medio término

**Proyecto:** Paniko · Seminario de Integración: Desarrollo  
**Equipo:** Paulina Villalpando Guizar, Saúl Mora y Gael Ramírez  
**Consulta:** 13 de noviembre de 2026 (hora de México; los comentarios aparecen en GitHub con fecha UTC del 14 de noviembre)

## ¿Cómo organizamos los cambios?

En Paniko usamos ramas para desarrollar funciones y documentación. Cuando preparamos un cambio, abrimos un Pull Request para poder leer los archivos modificados, ejecutar nuestras pruebas en GitHub Actions y compartir observaciones antes de integrar a la rama correspondiente. La rama `main` conserva por ahora la versión **0.7.2**; tenemos cambios posteriores en PRs de desarrollo que todavía no se fusionan.

## PRs que podemos mostrar en la exposición

| PR | Qué contiene | Estado verificado | Evidencia |
| --- | --- | --- | --- |
| [#9](https://github.com/paulinalizette70-boop/Paniko/pull/9) | Integración de Paniko 0.7.2: interfaz, recetas, producción e inventario | **Fusionado** con `main`. No se encontró aprobación formal de otro integrante | [CI aprobado en `main`](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43374837592) |
| [#18](https://github.com/paulinalizette70-boop/Paniko/pull/18) | Paniko 0.8.3: conversión de leche líquida, masa madre e inventario | **Abierto, borrador (Draft)**. Gael dejó comentarios, sin `Approve` formal registrado | [Comentario técnico de Gael](https://github.com/paulinalizette70-boop/Paniko/pull/18#issuecomment-6870981604) |
| [#19](https://github.com/paulinalizette70-boop/Paniko/pull/19) | Guion de demo, README, pruebas manuales y evidencias de medio término | **Abierto, no fusionado**. Saúl dejó comentarios y recibió respuesta, sin `Approve` formal | [Observación de Saúl](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870172329) · [CI aprobado](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43550663104) |

## Participación de Saúl

Saúl (`saulmora8831-hub`) [revisó la documentación del PR #19](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870172329). Destacó la distribución del guion de Sprint Review, el orden de las evidencias y que los casos de prueba de la versión 0.7.2 no se presentaran como ejecutados sin resultados. Su sugerencia fue **tener listos los accesos para las pruebas manuales** durante la demo.

Después escribió [«LGTM (Looks Good To Me)»](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870174609). Le [respondimos](https://github.com/paulinalizette70-boop/Paniko/pull/19#issuecomment-6870518057) que prepararíamos credenciales y base de datos de demostración, que seguía pendiente registrar los resultados de las pruebas manuales y que necesitábamos repartir la exposición.

**Estado:** observaciones y respuesta públicas; **no es una aprobación formal de revisión**.

## Participación de Gael

Gael (`gaelramirez3997-dev`) dejó un [comentario técnico en el PR #18](https://github.com/paulinalizette70-boop/Paniko/pull/18#issuecomment-6870981604). Indicó que revisó los commits `450a976` y `b6acfc6`, y consultó una [ejecución de GitHub Actions](https://github.com/paulinalizette70-boop/Paniko/actions/runs/43449512491). Su revisión se concentró en la conversión por densidad de leche líquida (equivalencia de referencia de 1 ml = 1.03 g) y el ajuste físico de masa madre cuando aparece en 0 g.

En su comentario explicó que **mantendría el PR como Draft** mientras prepara un respaldo de MySQL y verifica el comportamiento en Windows. Esa validación adicional **no debe marcarse como terminada** hasta que publique su resultado.

**Estado:** revisión técnica comentada; el PR sigue en borrador y **sin aprobación formal**.

## Qué podemos afirmar en la Sprint Review

> Los tres participamos en el trabajo del repositorio. Tenemos Pull Requests para la integración del sistema y la documentación, además de comentarios de Saúl y Gael sobre temas diferentes. También podemos enseñar los resultados de GitHub Actions. Estamos pendientes de documentar las aprobaciones formales y terminar los ensayos manuales antes de dar por cerrada la entrega.

## Pendientes para que la evidencia quede completa

- [ ] Ejecutar las pruebas manuales de la demo en una base separada de la real.
- [ ] Pedir a Saúl o Gael que revisen los cambios **actuales** del PR #19 y, si están de acuerdo, usen `Files changed → Review changes → Approve`. Un comentario escrito no equivale al evento formal `Approve`.
- [ ] Mantener #18 como Draft hasta terminar el respaldo y las verificaciones de Windows anunciadas por Gael.
- [ ] No fusionar PRs de código posteriores sin comprobar dependencias, migraciones de MySQL y pruebas.
- [ ] Guardar en la entrega individual los enlaces concretos y la participación que cada persona pueda demostrar.

**Privacidad:** los PRs de documentación no contienen recetas ni datos personales de clientes; las capturas completas de nuestra instalación local se conservan en el documento individual, no en el repositorio público.
