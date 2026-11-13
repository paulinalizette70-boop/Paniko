param([string]$Destino='D:\Paniko-main\Paniko-main')
$ErrorActionPreference='Stop'
$raiz=$PSScriptRoot
if(-not (Test-Path (Join-Path $Destino 'server.js'))){throw 'La carpeta destino no parece una instalación de Paniko.'}
if(-not (Test-Path (Join-Path $Destino '.env'))){throw 'No se encontró .env. No se ha modificado nada.'}
$version=(Get-Content -LiteralPath (Join-Path $Destino 'package.json') -Raw|ConvertFrom-Json).version
if($version -ne '0.7.4'){throw "Se requiere Paniko 0.7.4 y se detectó $version. No se ha modificado nada."}
$archivos=@(
'server.js',
'src\app.js','src\finished-products.js','src\finance-dashboard.js','src\sourdough.js',
'public\app.js','public\index.html','public\styles.css','public\sourdough.js',
'scripts\init-db.js','scripts\migrate-finance-and-starter.js',
'tests\finished-products.test.js','tests\finance-dashboard-080.test.js','tests\sourdough-080.test.js','tests\mysql-finance-sourdough-080.test.js',
'package.json','package-lock.json','docs\releases\Paniko-0.8.0-finanzas-y-masa-madre.md')
foreach($archivo in $archivos){if(-not (Test-Path -LiteralPath (Join-Path $raiz $archivo))){throw "El paquete está incompleto: $archivo"}}
Write-Host "Programa: $Destino"
Write-Host 'Nueva versión: 0.8.0 — Finanzas y masa madre'
Write-Host 'Nuevas tablas: registros financieros de ventas, gastos, cultivos y alimentaciones.'
Write-Host 'No se eliminan tablas, se reescriben ventas antiguas ni se alteran recetas, existencias o movimientos anteriores.'
Write-Host 'El instalador respeta .env, private, data y node_modules.'
Write-Warning 'Antes de continuar: cierra el servidor y exporta una copia completa de tu base MySQL desde Workbench: Server > Data Export.'
$ok=Read-Host 'Después del respaldo, escribe ACTUALIZAR para instalar 0.8.0 (Enter cancela)'
if($ok -cne 'ACTUALIZAR'){Write-Host 'Actualización cancelada: ningún cambio.';exit 0}
$respaldo=Join-Path (Split-Path -Parent $Destino) ('Paniko_respaldo_codigo_080_'+(Get-Date -Format 'yyyyMMdd_HHmmss'))
$existe=@{}
foreach($archivo in $archivos){
  $original=Join-Path $Destino $archivo
  $existe[$archivo]=Test-Path -LiteralPath $original
  if($existe[$archivo]){
    $copia=Join-Path $respaldo $archivo
    New-Item -ItemType Directory -Path (Split-Path -Parent $copia) -Force|Out-Null
    Copy-Item -LiteralPath $original -Destination $copia -Force
  }
}
Write-Host "Respaldo del código: $respaldo"
$copiados=New-Object System.Collections.Generic.List[string]
try{
 foreach($archivo in $archivos){
    $origen=Join-Path $raiz $archivo;$dest=Join-Path $Destino $archivo
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force|Out-Null
    Copy-Item -LiteralPath $origen -Destination $dest -Force;$copiados.Add($archivo)
    if((Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $origen -Algorithm SHA256).Hash){throw "Error verificando $archivo"}
 }
 Push-Location $Destino
 try{
   & node --env-file=.env scripts/migrate-finance-and-starter.js --apply
   if($LASTEXITCODE -ne 0){throw 'La migración MySQL falló. Revisa el mensaje de error.'}
 }finally{Pop-Location}
}catch{
  Write-Warning "La instalación no terminó: $($_.Exception.Message)"
  foreach($archivo in $copiados){
    $actual=Join-Path $Destino $archivo
    if($existe[$archivo]){Copy-Item -LiteralPath (Join-Path $respaldo $archivo) -Destination $actual -Force}
    elseif(Test-Path -LiteralPath $actual){Remove-Item -LiteralPath $actual -Force}
  }
  throw 'Se restauró el código anterior. La migración puede haber creado alguna tabla nueva: no se borró ninguna.'
}
Write-Host 'Paniko 0.8.0 instalado correctamente. No reinicies sin ejecutar npm.cmd test.' -ForegroundColor Green
Write-Host "Respaldo: $respaldo"
Write-Host 'Comprobar: cd al programa; npm.cmd test; node --env-file=.env server.js'
