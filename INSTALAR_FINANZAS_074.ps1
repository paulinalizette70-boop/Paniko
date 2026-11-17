param([string]$Destino='D:\Paniko-main\Paniko-main')
$ErrorActionPreference='Stop'
$raiz=$PSScriptRoot
if(-not (Test-Path -LiteralPath (Join-Path $Destino 'server.js'))){throw "No parece una carpeta de Paniko: $Destino"}
if(-not (Test-Path -LiteralPath (Join-Path $Destino '.env'))){throw 'Falta .env en tu instalación. No se modificó nada.'}
$version=(Get-Content -LiteralPath (Join-Path $Destino 'package.json') -Raw | ConvertFrom-Json).version
if($version -notin @('0.7.1','0.7.2','0.7.3','0.7.4')){throw "Versión incompatible: $version. No se modificó nada."}
# Conjunto completo del código necesario para actualizar desde 0.7.1, 0.7.2 o 0.7.3.
$archivos=@()
foreach($carpeta in @('src','public','tests')){
  $archivos+=Get-ChildItem -LiteralPath (Join-Path $raiz $carpeta) -File | ForEach-Object { "$carpeta\$($_.Name)" }
}
$archivos+=@('package.json','package-lock.json','README.md','scripts\migrate-product-cost.js','sql\finished-products.sql','docs\releases\Paniko-0.7.4-finanzas.md')
foreach($archivo in $archivos){if(-not (Test-Path -LiteralPath (Join-Path $raiz $archivo))){throw "Paquete incompleto: $archivo"}}
Write-Host "Instalación actual: $Destino"
Write-Host "Versión: $version -> 0.7.4"
Write-Host 'La modificación de MySQL añade únicamente una columna opcional de costo unitario.'
Write-Host 'No se borrarán ni modificarán registros, ventas, recetas o existencias.'
Write-Host 'Los archivos .env, private, data y node_modules NO se copiarán ni sobrescribirán.'
Write-Warning 'IMPORTANTE: exporta una copia de seguridad de tu base MySQL desde Workbench ANTES de continuar.'
$aceptacion=Read-Host 'Después del respaldo, escribe ACTUALIZAR para instalar y agregar la columna; Enter cancela'
if($aceptacion -cne 'ACTUALIZAR'){Write-Host 'Cancelado. No se hicieron cambios.';exit 0}
$respaldo=Join-Path (Split-Path -Parent $Destino) ('Paniko_respaldo_codigo_074_'+(Get-Date -Format 'yyyyMMdd_HHmmss'))
$existe=@{}
# Respaldar todos los archivos de código ANTES de la primera copia.
foreach($archivo in $archivos){
  $original=Join-Path $Destino $archivo
  $existe[$archivo]=Test-Path -LiteralPath $original
  if($existe[$archivo]){
    $copia=Join-Path $respaldo $archivo
    New-Item -Force -ItemType Directory -Path (Split-Path -Parent $copia)|Out-Null
    Copy-Item -LiteralPath $original -Destination $copia -Force
  }
}
Write-Host "Copia de respaldo de código: $respaldo"
$instalados=New-Object System.Collections.Generic.List[string]
try{
  foreach($archivo in $archivos){
    $nuevo=Join-Path $raiz $archivo
    $actual=Join-Path $Destino $archivo
    New-Item -Force -ItemType Directory -Path (Split-Path -Parent $actual)|Out-Null
    Copy-Item -LiteralPath $nuevo -Destination $actual -Force
    $instalados.Add($archivo)
    if((Get-FileHash -LiteralPath $actual -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $nuevo -Algorithm SHA256).Hash){throw "Error verificando el archivo $archivo"}
  }
  Push-Location $Destino
  try {
    & node --env-file=.env scripts/migrate-product-cost.js --apply
    if($LASTEXITCODE -ne 0){throw 'La migración MySQL falló; se restaurará el código original.'}
  }finally{Pop-Location}
}catch{
  Write-Warning "No se completó la instalación: $($_.Exception.Message)"
  foreach($archivo in $instalados){
    $original=Join-Path $Destino $archivo
    if($existe[$archivo]){Copy-Item -LiteralPath (Join-Path $respaldo $archivo) -Destination $original -Force}
    elseif(Test-Path -LiteralPath $original){Remove-Item -LiteralPath $original -Force}
  }
  throw 'Se restauró el código anterior. No reinicies Paniko hasta revisar el error.'
}
Write-Host 'Instalación completada: Paniko 0.7.4' -ForegroundColor Green
Write-Host "Respaldo de código: $respaldo"
Write-Host 'Ejecuta cd al programa, npm.cmd test y node --env-file=.env server.js'
