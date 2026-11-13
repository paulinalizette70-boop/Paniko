param([string]$Destino='D:\Paniko-main\Paniko-main')
$ErrorActionPreference='Stop'
$raiz=$PSScriptRoot
if(-not (Test-Path -LiteralPath (Join-Path $Destino 'server.js'))){throw 'Carpeta de Paniko no encontrada: no se modifico nada.'}
if(-not (Test-Path -LiteralPath (Join-Path $Destino '.env'))){throw 'Falta .env. No se modifico nada.'}
$actual=(Get-Content -LiteralPath (Join-Path $Destino 'package.json') -Raw | ConvertFrom-Json).version
if($actual -ne '0.8.2'){throw "Se requiere Paniko 0.8.2; la version encontrada es $actual. No se modifico nada."}
$nueva=(Get-Content -LiteralPath (Join-Path $raiz 'package.json') -Raw | ConvertFrom-Json).version
if($nueva -ne '0.8.3'){throw 'El paquete no corresponde a Paniko 0.8.3. No se modifico nada.'}
$archivos=@(
 'src\app.js','src\domain.js','src\sourdough.js',
 'public\app.js','public\index.html','public\sourdough.js',
 'tests\bakers-percent.test.js','tests\starter-inventory-082.test.js',
 'tests\unit-conversions-egg-water.test.js','tests\fixes-083-milk-and-sourdough.test.js',
 'tests\mysql-starter-milk-083.test.js','tests\sourdough-api-083.test.js',
 'package.json','package-lock.json',
 'docs\releases\Paniko-0.8.3-masa-madre-y-leche.md'
)
foreach($archivo in $archivos){
 if(-not(Test-Path -LiteralPath (Join-Path $raiz $archivo))){throw "Paquete incompleto: $archivo. No se modifico nada."}
}
Write-Host "Programa: $Destino"
Write-Host 'Version: 0.8.2 -> 0.8.3'
Write-Host 'Solo se cambiara codigo. No se modificaran existencias ni datos MySQL durante la instalacion.'
Write-Host '.env, private, data y node_modules permanecen intactos.'
$ok=Read-Host 'Con el servidor cerrado, escribe ACTUALIZAR para continuar; Enter cancela'
if($ok -cne 'ACTUALIZAR'){Write-Host 'Cancelado; no se realizaron cambios.';exit 0}
$respaldo=Join-Path (Split-Path -Parent $Destino) ('Paniko_respaldo_codigo_083_'+(Get-Date -Format 'yyyyMMdd_HHmmss'))
$existe=@{}
foreach($archivo in $archivos){
 $actualRuta=Join-Path $Destino $archivo
 $existe[$archivo]=Test-Path -LiteralPath $actualRuta
 if($existe[$archivo]){
  $dest=Join-Path $respaldo $archivo
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest)|Out-Null
  Copy-Item -LiteralPath $actualRuta -Destination $dest -Force
 }
}
Write-Host "Respaldo del codigo: $respaldo"
$copiados=New-Object System.Collections.Generic.List[string]
try{
 foreach($archivo in $archivos){
  $origen=Join-Path $raiz $archivo;$dest=Join-Path $Destino $archivo
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest)|Out-Null
  Copy-Item -LiteralPath $origen -Destination $dest -Force
  $copiados.Add($archivo)
  if((Get-FileHash -LiteralPath $origen -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash){throw "No se pudo verificar $archivo"}
 }
 Push-Location $Destino
 try{
  & npm.cmd test
  if($LASTEXITCODE -ne 0){throw 'Fallo npm.cmd test. Se restaurara el codigo anterior.'}
 }finally{Pop-Location}
 Write-Host 'Paniko 0.8.3 instalado. Pruebas de codigo aprobadas.' -ForegroundColor Green
 Write-Host "Respaldo: $respaldo"
 Write-Host 'Iniciar: node --env-file=.env server.js'
}catch{
 $mensaje=$_.Exception.Message
 foreach($archivo in $copiados){
  $dest=Join-Path $Destino $archivo
  if($existe[$archivo]){Copy-Item -LiteralPath (Join-Path $respaldo $archivo) -Destination $dest -Force}
  elseif(Test-Path -LiteralPath $dest){Remove-Item -LiteralPath $dest -Force}
 }
 Write-Warning 'Se restauro el codigo anterior. No se toco la base de datos.'
 throw $mensaje
}
