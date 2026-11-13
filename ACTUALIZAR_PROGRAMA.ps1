# Paniko 0.7.1: instalación de código, no cambia .env ni MySQL.
param([string]$Destino = 'D:\Paniko-main\Paniko-main')
$ErrorActionPreference='Stop'
try {
  $Origen=(Resolve-Path -LiteralPath $PSScriptRoot).Path
  if(-not (Test-Path -LiteralPath $Destino -PathType Container)) {throw "No se encontró el programa: $Destino"}
  $Destino=(Resolve-Path -LiteralPath $Destino).Path
  if($Origen -eq $Destino){throw 'Extrae el parche fuera de la carpeta del programa.'}
  foreach($Required in @('server.js','src\auth.js','src\mysql-store.js','public\products.js','package.json','.env')){
    if(-not (Test-Path -LiteralPath (Join-Path $Destino $Required) -PathType Leaf)){throw "No está $Required en el programa de destino"}
  }
  $Current=(Get-Content -LiteralPath (Join-Path $Destino 'package.json') -Raw | ConvertFrom-Json)
  if($Current.name -ne 'paniko' -or $Current.version -notin @('0.6.3','0.7.0')){
    throw "Se requiere Paniko 0.6.3 o 0.7.0. Versión actual: $($Current.version). No se hicieron cambios."
  }
  $Incoming=(Get-Content -LiteralPath (Join-Path $Origen 'package.json') -Raw | ConvertFrom-Json)
  if($Incoming.version -ne '0.7.1'){throw 'El parche no corresponde a Paniko 0.7.1.'}
  $Files=@(
    'src\app.js',
    'src\auth.js',
    'src\mysql-store.js',
    'src\store.js',
    'src\finished-products.js',
    'src\catalog-to-recipe.js',
    'public\index.html',
    'public\styles.css',
    'public\app.js',
    'public\products.js',
    'tests\auth-security.test.js',
    'tests\finished-products.test.js',
    'tests\stock-adjustments.test.js',
    'tests\ui-redesign.test.js',
    'tests\roles-and-finances.test.js',
    'tests\catalog-to-technical-sheet.test.js',
    'package.json',
    'package-lock.json',
    'README.md'
  )
  foreach($Relative in $Files){
    if(-not (Test-Path -LiteralPath (Join-Path $Origen $Relative) -PathType Leaf)){throw "El parche está incompleto: $Relative"}
  }
  $Backup=Join-Path (Split-Path -Parent $Destino) ('Paniko_respaldo_codigo_071_'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
  Write-Host "Programa: $Destino";Write-Host "Respaldo de código: $Backup"
  Write-Host 'No se modificarán .env, private, data, node_modules, contraseñas, existencias ni tablas MySQL.'
  Write-Host 'Las fichas se crearán SOLO si después pulsas «Crear ficha técnica» desde la web.'
  $Approval=Read-Host 'Escribe ACTUALIZAR para instalar 0.7.1, o Enter para cancelar'
  if($Approval -cne 'ACTUALIZAR'){Write-Host 'Cancelado sin cambios';exit 0}
  $Existed=@();$Created=@()
  foreach($Relative in $Files){
    $Old=Join-Path $Destino $Relative
    if(Test-Path -LiteralPath $Old -PathType Leaf){
      $Existed+=$Relative
      $Back=Join-Path $Backup $Relative
      New-Item -ItemType Directory -Path (Split-Path -Parent $Back) -Force | Out-Null
      Copy-Item -LiteralPath $Old -Destination $Back -Force
    }else{$Created+=$Relative}
  }
  Write-Host 'Respaldo terminado.'
  try {
    foreach($Relative in $Files){
      $Target=Join-Path $Destino $Relative
      New-Item -ItemType Directory -Path (Split-Path -Parent $Target) -Force | Out-Null
      Copy-Item -LiteralPath (Join-Path $Origen $Relative) -Destination $Target -Force
      Write-Host "Actualizado: $Relative"
    }
  }catch{
    $Issue=$_.Exception.Message
    foreach($Relative in $Existed){Copy-Item -LiteralPath (Join-Path $Backup $Relative) -Destination (Join-Path $Destino $Relative) -Force}
    foreach($Relative in $Created){$Target=Join-Path $Destino $Relative;if(Test-Path -LiteralPath $Target){Remove-Item -LiteralPath $Target -Force}}
    throw "No se completó la instalación; se restauró el respaldo. $Issue"
  }
  Write-Host 'Paniko 0.7.1 instalado. Ejecuta npm.cmd test desde la carpeta del programa.' -ForegroundColor Green
  Write-Host "Respaldo: $Backup"
}catch{Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red; exit 1}
