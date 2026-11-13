param([string]$Destino='D:\Paniko-main\Paniko-main')
$ErrorActionPreference='Stop'
$raiz=$PSScriptRoot
if(-not (Test-Path -LiteralPath (Join-Path $Destino 'server.js'))){throw 'Carpeta destino no parece Paniko. No se modificó nada.'}
if(-not (Test-Path -LiteralPath (Join-Path $Destino '.env'))){throw 'No se encontró .env. No se modificó nada.'}
$version=(Get-Content -LiteralPath (Join-Path $Destino 'package.json') -Raw|ConvertFrom-Json).version
if($version -notin @('0.7.4','0.8.0')){throw "Se esperaba Paniko 0.7.4 u 0.8.0; se detectó $version. No se modificó nada."}
$archivos=@(
'server.js',
'src\app.js',
'src\domain.js',
'src\catalog-to-recipe.js',
'src\mysql-store.js',
'src\store.js',
'src\calendar.js',
'src\finished-products.js',
'src\finance-dashboard.js',
'src\sourdough.js',
'public\index.html',
'public\styles.css',
'public\app.js',
'public\products.js',
'public\sourdough.js',
'public\calendar.js',
'scripts\init-db.js',
'scripts\migrate-finance-and-starter.js',
'scripts\migrate-calendar-yields-081.js',
'sql\schema.sql',
'tests\production-finished.test.js',
'tests\finished-products.test.js',
'tests\finance-dashboard-080.test.js',
'tests\sourdough-080.test.js',
'tests\mysql-finance-sourdough-080.test.js',
'tests\migration-080.test.js',
'tests\calendar-and-yields-081.test.js',
'tests\mysql-calendar-yields-081.test.js',
'package.json',
'package-lock.json',
'docs\releases\Paniko-0.8.1-calendario-fichas-por-peso.md'
)

foreach($archivo in $archivos){
 if(-not(Test-Path -LiteralPath (Join-Path $raiz $archivo))){throw "El paquete está incompleto: $archivo. No se modificó nada."}
}
Write-Host "Programa: $Destino"
Write-Host "Versión actual: $version -> 0.8.1"
Write-Host 'Novedades: calendario mensual, pendientes y fichas que rinden piezas, g o ml.'
Write-Host 'La migración agrega dos columnas con unidad por defecto pieza y una tabla nueva de calendario.'
Write-Host 'No se eliminan tablas, ventas, inventario, recetas ni lotes anteriores.'
Write-Host 'Se preservan .env, private, data y node_modules.'
Write-Warning 'ANTES DE CONTINUAR: cierra el servidor Paniko y haz una exportación de tu base MySQL en Workbench (Server > Data Export). Este respaldo de MySQL NO lo hace el instalador.'
$ok=Read-Host 'Después del respaldo de MySQL, escribe ACTUALIZAR para instalar 0.8.1 (Enter cancela)'
if($ok -cne 'ACTUALIZAR'){Write-Host 'Actualización cancelada: no se hicieron cambios.';exit 0}
$respaldo=Join-Path (Split-Path -Parent $Destino) ('Paniko_respaldo_codigo_081_'+(Get-Date -Format 'yyyyMMdd_HHmmss'))
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
Write-Host "Respaldo de código: $respaldo"
$copiados=New-Object System.Collections.Generic.List[string]
try{
 foreach($archivo in $archivos){
  $origen=Join-Path $raiz $archivo;$dest=Join-Path $Destino $archivo
  New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force|Out-Null
  Copy-Item -LiteralPath $origen -Destination $dest -Force
  $copiados.Add($archivo)
  if((Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $origen -Algorithm SHA256).Hash){throw "Error de verificación: $archivo"}
 }
 Push-Location $Destino
 try{
  if($version -eq '0.7.4'){
   Write-Host 'Migrando tablas de Finanzas y masa madre de 0.8.0...'
   & node --env-file=.env scripts/migrate-finance-and-starter.js --apply
   if($LASTEXITCODE -ne 0){throw 'No se completó la migración financiera 0.8.0'}
  }
  Write-Host 'Migrando unidades de recetas y calendario de 0.8.1...'
  & node --env-file=.env scripts/migrate-calendar-yields-081.js --apply
  if($LASTEXITCODE -ne 0){throw 'No se completó la migración calendario 0.8.1'}
  Write-Host 'Ejecutando pruebas no destructivas...'
  & npm.cmd test
  if($LASTEXITCODE -ne 0){throw 'La suite local de pruebas no pasó; se restaurará el código anterior'}
 }finally{Pop-Location}
 Write-Host 'Paniko 0.8.1 instalado y pruebas aprobadas.' -ForegroundColor Green
 Write-Host "Respaldo de código: $respaldo"
 Write-Host "Inicia con: cd `"$Destino`"; node --env-file=.env server.js"
}catch{
 $mensaje=$_.Exception.Message
 Write-Warning "Falló la instalación: $mensaje"
 foreach($archivo in $copiados){
  $dest=Join-Path $Destino $archivo
  if($existe[$archivo]){Copy-Item -LiteralPath (Join-Path $respaldo $archivo) -Destination $dest -Force}
  elseif(Test-Path -LiteralPath $dest){Remove-Item -LiteralPath $dest -Force}
 }
 Write-Warning 'Código anterior restaurado. Las modificaciones DDL de MySQL ya aplicadas pueden persistir; son aditivas e idempotentes. No reimportes ni borres datos.'
 throw $mensaje
}
