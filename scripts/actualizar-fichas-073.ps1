param([string]$Destino = 'D:\Paniko-main\Paniko-main')
$ErrorActionPreference='Stop'
$files=@(
  'src\app.js',
  'src\auth.js',
  'src\catalog-edit.js',
  'src\catalog-to-recipe.js',
  'src\domain.js',
  'src\inventory.js',
  'src\mysql-store.js',
  'src\private-catalog-store.js',
  'src\store.js',
  'public\app.js',
  'public\index.html',
  'public\styles.css',
  'tests\recipe-editing.test.js',
  'tests\bakers-percent.test.js',
  'tests\unit-conversions-egg-water.test.js',
  'package.json',
  'package-lock.json',
  'docs\releases\Paniko-0.7.3-edicion-recetas.md'
)
$payloadRoot=$PSScriptRoot
if(-not (Test-Path -LiteralPath (Join-Path $payloadRoot 'src\app.js'))){
  $payloadRoot=Split-Path -Parent $PSScriptRoot
}
if(-not (Test-Path -LiteralPath (Join-Path $Destino 'server.js'))){ throw 'La carpeta elegida no parece una instalación de Paniko.' }
$version=(Get-Content -LiteralPath (Join-Path $Destino 'package.json') -Raw | ConvertFrom-Json).version
if($version -notin @('0.7.1','0.7.2','0.7.3')){throw "Version local no compatible: $version. No se cambió nada."}
foreach($file in $files){
  if(-not (Test-Path -LiteralPath (Join-Path $payloadRoot $file))){throw "Paquete incompleto: $file"}
}
Write-Host "Instalación: $Destino"
Write-Host "Versión actual: $version  -> 0.7.3"
Write-Host 'Se respetarán .env, private, data, node_modules y tu base MySQL.'
Write-Host 'La instalación no crea fichas, no cambia recetas guardadas ni modifica existencias.'
$consent=Read-Host 'Escribe ACTUALIZAR para instalar, o pulsa Enter para cancelar'
if($consent -cne 'ACTUALIZAR'){Write-Host 'Cancelado. Ningún archivo modificado.';exit 0}
$backup=Join-Path (Split-Path -Parent $Destino) ('Paniko_respaldo_codigo_073_'+(Get-Date -Format 'yyyyMMdd_HHmmss'))
$original=@{}
# Crear un respaldo completo ANTES de sustituir un solo archivo.
foreach($file in $files){
  $current=Join-Path $Destino $file
  $original[$file]=(Test-Path -LiteralPath $current)
  if($original[$file]){
    $copy=Join-Path $backup $file
    New-Item -ItemType Directory -Path (Split-Path -Parent $copy) -Force | Out-Null
    Copy-Item -LiteralPath $current -Destination $copy -Force
  }
}
Write-Host "Respaldo preparado: $backup"
$copied=New-Object System.Collections.Generic.List[string]
try{
  foreach($file in $files){
    $target=Join-Path $Destino $file
    $source=Join-Path $payloadRoot $file
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
    $copied.Add($file)
    $sourceHash=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $targetHash=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
    if($sourceHash -ne $targetHash){throw "No se copió correctamente el archivo $file"}
    Write-Host "Actualizado: $file"
  }
}catch{
  Write-Warning "Error al instalar: $($_.Exception.Message). Se restaurarán los archivos respaldados."
  foreach($file in $copied){
    $target=Join-Path $Destino $file
    if($original[$file]){ Copy-Item -LiteralPath (Join-Path $backup $file) -Destination $target -Force }
    elseif(Test-Path -LiteralPath $target){ Remove-Item -LiteralPath $target -Force }
  }
  throw
}
Write-Host 'Paniko 0.7.3 instalado. Ejecuta npm.cmd test desde tu carpeta del programa.' -ForegroundColor Green
Write-Host "Respaldo: $backup"
