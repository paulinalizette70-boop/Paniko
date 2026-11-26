param([string]$Destino='D:\Paniko-main\Paniko-main')
$ErrorActionPreference='Stop'
$raiz=$PSScriptRoot
if(-not (Test-Path -LiteralPath (Join-Path $Destino 'server.js'))){throw 'No parece una carpeta de Paniko. No se modificó nada.'}
if(-not (Test-Path -LiteralPath (Join-Path $Destino '.env'))){throw 'Falta la conexión local .env. No se modificó nada.'}
$version=(Get-Content -LiteralPath (Join-Path $Destino 'package.json') -Raw | ConvertFrom-Json).version
if($version -notin @('0.8.0','0.8.1')){throw "Versión actual $version. Este instalador requiere Paniko 0.8.0 u 0.8.1."}
$archivos=@('server.js','package.json','package-lock.json','docs\releases\Paniko-0.8.2-masa-madre-inventario.md')
foreach($carpeta in @('src','public','tests','scripts','sql')){
  $archivos+=Get-ChildItem -LiteralPath (Join-Path $raiz $carpeta) -File | ForEach-Object { "$carpeta\$($_.Name)" }
}
foreach($archivo in $archivos){if(-not(Test-Path -LiteralPath (Join-Path $raiz $archivo))){throw "Paquete incompleto: $archivo"}}
Write-Host "Programa: $Destino"
Write-Host "Versión actual: $version -> 0.8.2"
Write-Host 'Alimentaciones: descontar harina y agua y aumentar masa madre en Inventario.'
Write-Host 'La migración de esquema es aditiva; no se alterarán registros ni existencias durante la instalación.'
Write-Host '.env, private, data y node_modules se conservarán.'
Write-Warning 'ANTES DE CONTINUAR: cierra Paniko y exporta TODA tu base MySQL desde Workbench (Server > Data Export). Este instalador NO realiza ese respaldo.'
$ok=Read-Host 'Tras guardar el respaldo MySQL, escribe ACTUALIZAR para continuar; Enter cancela'
if($ok -cne 'ACTUALIZAR'){Write-Host 'Cancelado. No se realizaron cambios.';exit 0}
$respaldo=Join-Path (Split-Path -Parent $Destino) ('Paniko_respaldo_codigo_082_'+(Get-Date -Format 'yyyyMMdd_HHmmss'))
$existe=@{}
foreach($archivo in $archivos){
 $original=Join-Path $Destino $archivo
 $existe[$archivo]=Test-Path -LiteralPath $original
 if($existe[$archivo]){
  $copia=Join-Path $respaldo $archivo
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $copia)|Out-Null
  Copy-Item -LiteralPath $original -Destination $copia -Force
 }
}
Write-Host "Respaldo de código: $respaldo"
$copiados=New-Object System.Collections.Generic.List[string]
try{
 foreach($archivo in $archivos){
  $origen=Join-Path $raiz $archivo;$dest=Join-Path $Destino $archivo
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest)|Out-Null
  Copy-Item -LiteralPath $origen -Destination $dest -Force
  $copiados.Add($archivo)
  if((Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $origen -Algorithm SHA256).Hash){throw "Fallo al verificar $archivo"}
 }
 Push-Location $Destino
 try{
  if($version -eq '0.8.0'){
   & node --env-file=.env scripts/migrate-calendar-yields-081.js --apply
   if($LASTEXITCODE -ne 0){throw 'Migración de calendario y rendimientos no completada'}
  }
  & node --env-file=.env scripts/migrate-starter-inventory-082.js --apply
  if($LASTEXITCODE -ne 0){throw 'Migración de vínculos de masa madre no completada'}
  & npm.cmd test
  if($LASTEXITCODE -ne 0){throw 'La prueba de código falló: se restaurará el código anterior'}
 }finally{Pop-Location}
 Write-Host 'Paniko 0.8.2 actualizado, pruebas completadas.' -ForegroundColor Green
 Write-Host "Respaldo del código: $respaldo"
 Write-Host "Para iniciar: cd `"$Destino`"; node --env-file=.env server.js"
}catch{
 $mensaje=$_.Exception.Message
 foreach($archivo in $copiados){
  $dest=Join-Path $Destino $archivo
  if($existe[$archivo]){Copy-Item -LiteralPath (Join-Path $respaldo $archivo) -Destination $dest -Force}
  elseif(Test-Path -LiteralPath $dest){Remove-Item -LiteralPath $dest -Force}
 }
 Write-Warning 'Código anterior restaurado. Los cambios de esquema MySQL aditivos pueden persistir: consulta el respaldo de MySQL si fuese necesario.'
 throw $mensaje
}
