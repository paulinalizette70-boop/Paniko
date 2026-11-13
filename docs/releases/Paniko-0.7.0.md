PANIKO 0.7.0 - REDISENIO DE LA PAGINA WEB
=======================================

Esta actualizacion mejora la experiencia de uso sin reemplazar la base MySQL.

CAMBIOS
- Menu por secciones: Inicio, Produccion, Ingredientes, Recetas, Productos y ventas, Historial.
- Panel de inicio con resumen y accesos rapidos.
- Produccion organizada en pasos, con confirmacion habilitada solo tras calcular la vista previa.
- Buscadores de ingredientes, recetas y productos (aceptan consultas sin acentos).
- Formularios de inventario y creacion plegables.
- Ventas destacadas en el inventario de productos terminados.
- Interfaz adaptable para telefono y computadora.
- Se respetan permisos de administrador y operador.

IMPORTANTE
- Es un cambio de interfaz, no cambia tablas ni credenciales MySQL.
- No se modifican .env, private, data, node_modules, recetas, contrasenas ni respaldos.
- La instalacion debe hacerse sobre Paniko 0.6.3.

INSTALACION
1) Cierra el servidor actual (Ctrl+C).
2) Extrae el ZIP en una carpeta distinta a D:\Paniko-main\Paniko-main.
3) Abre PowerShell en la carpeta Paniko-0.7.0.
4) Ejecuta:
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ACTUALIZAR_PROGRAMA.ps1 -Destino "D:\Paniko-main\Paniko-main"
5) Revisa las rutas y escribe ACTUALIZAR.
6) Para comprobar la nueva version y las pruebas:
   cd "D:\Paniko-main\Paniko-main"
   node -p "require('./package.json').version"
   npm.cmd test
7) Para iniciar el programa:
   node --env-file=.env server.js
8) Abre http://127.0.0.1:3000 y usa Ctrl+F5.

No publiques este ZIP junto con la carpeta privada ni con archivos .env.
