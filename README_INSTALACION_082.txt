PANIKO 0.8.2 - MASA MADRE CON INVENTARIO

1. Detén Paniko con Ctrl+C.
2. En MySQL Workbench crea un respaldo completo de tu BD: Server > Data Export.
3. En PowerShell, dentro de la carpeta que contiene el instalador:
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_PANIKO_082.ps1 -Destino "D:\Paniko-main\Paniko-main"
4. Revisa la ruta; escribe ACTUALIZAR solo después del respaldo MySQL.
5. Abre PowerShell en D:\Paniko-main\Paniko-main y ejecuta:
   npm.cmd test
   node --env-file=.env server.js
6. En Paniko, Mi masa madre > Conectar con inventario.
   Selecciona Masa madre, Harina y Agua de tu lista de Ingredientes.
   Si no existen, agrégalos primero desde Ingredientes (con la existencia real).
7. Registra una alimentación de prueba con cantidades reales y comprueba movimientos.

La vinculación NO cambia existencias: toma como referencia el stock de Masa madre.
Alimentar SÍ descuenta harina, agua y descarte y añade la masa madre alimentada.
Producciones de recetas que consuman Masa madre también se reflejarán en el cuadro.

Tu .env, private/, data/ y node_modules/ no se sobreescriben.
El instalador respalda código, pero NO crea un respaldo de MySQL.
