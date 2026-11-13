# Paniko 0.7.2 — Conversiones y porcentaje panadero

## Cambios
- 1 huevo equivale a 50 g sin cáscara; el agua permite 1 g ≈ 1 ml.
- Creación de fichas sin existencias; el stock se comprueba al producir.
- % panadero calculado sobre la suma de las harinas, equivalente al 100 %.
- Si una unidad carece de peso conocido, o falta harina, no se inventan porcentajes.
- Vista previa antes de guardar, detalle de ficha y vista previa de producción.
- El personal puede consultar fórmulas; finanzas continúa restringido al administrador.

## Validación local
- 65 pruebas aprobadas, 0 fallidas, 5 omitidas por requerir MySQL aislado.
- Simulación de instalación 0.7.1 a 0.7.2: resultados idénticos.
- Sin cambios a tablas, MySQL Workbench, .env o archivos private.

## Instalación local
Requiere Paniko 0.7.1. Descomprimir el ZIP Paniko_0.7.2_unidades_y_porcentaje_panadero.zip y abrir PowerShell dentro de Paniko-0.7.2.
Comando: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ACTUALIZAR_PROGRAMA.ps1 -Destino "D:\Paniko-main\Paniko-main"
Escribir ACTUALIZAR. Después npm.cmd test y node --env-file=.env server.js.
