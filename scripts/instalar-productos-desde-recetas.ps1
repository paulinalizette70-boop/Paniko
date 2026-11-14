param([string]$Destino = 'D:\Paniko-main\Paniko-main')
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path -LiteralPath (Join-Path $Destino '.env'))) {
  throw 'No se encontro .env. No se modifico nada.'
}
if (-not (Test-Path -LiteralPath (Join-Path $Destino 'server.js'))) {
  throw 'No se encontro Paniko. No se modifico nada.'
}
$version = (Get-Content -LiteralPath (Join-Path $Destino 'package.json') -Raw | ConvertFrom-Json).version
if ($version -ne '0.8.3') {
  throw "Se necesita la version base Paniko 0.8.3. Encontrada: $version."
}
if (-not (Test-Path -LiteralPath (Join-Path $Destino 'public\dough.js'))) {
  throw 'Primero instala Produccion por formatos de brioche. No se modifico nada.'
}
$archivos = @(
  'server.js',
  'src\app.js',
  'src\dough-formats.js',
  'src\dough-preparations.js',
  'scripts\init-db.js',
  'scripts\migrate-dough-preparations.js',
  'public\index.html',
  'public\app.js',
  'public\dough.js',
  'public\styles.css',
  'tests\dough-preparations-api.test.js',
  'tests\mysql-dough-preparations.test.js',
  'docs\releases\Paniko-productos-desde-recetas-y-subpreparaciones.md'
)
foreach ($archivo in $archivos) {
  if (-not (Test-Path -LiteralPath (Join-Path $raiz $archivo))) {
    throw "Paquete incompleto: $archivo. No se modifico nada."
  }
}
Write-Host 'Paniko: productos desde receta base + subpreparaciones.'
Write-Host "Destino: $Destino"
Write-Warning 'Cierra el servidor de Paniko antes de continuar.'
Write-Host 'Se respaldara el codigo; NO se modificara MySQL en esta instalacion.'
$confirm = Read-Host 'Escribe ACTUALIZAR para copiar codigo, Enter para cancelar'
if ($confirm -cne 'ACTUALIZAR') { Write-Host 'Cancelado.'; exit 0 }

$respaldo = Join-Path (Split-Path -Parent $Destino) ('Respaldo_RecetasPreparaciones_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$anteriores = @(); $nuevos = @()
foreach ($archivo in $archivos) {
  $dest = Join-Path $Destino $archivo
  if (Test-Path -LiteralPath $dest) {
    $backup = Join-Path $respaldo $archivo
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backup) | Out-Null
    Copy-Item -LiteralPath $dest -Destination $backup -Force
    $anteriores += $archivo
  } else {
    $nuevos += $archivo
  }
}
try {
  foreach ($archivo in $archivos) {
    $dest = Join-Path $Destino $archivo
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
    Copy-Item -LiteralPath (Join-Path $raiz $archivo) -Destination $dest -Force
  }
  $html=Get-Content -LiteralPath (Join-Path $Destino 'public\index.html') -Raw
  if (-not $html.Contains('dough-prep-batch-form') -or -not $html.Contains('Crear producto desde esta masa')) {
    throw 'El nuevo formulario no fue instalado correctamente.'
  }
  if ($html.Contains('<span>Brioche y formatos</span>')) {
    throw 'La opcion lateral no debe existir.'
  }
  Write-Host 'Codigo instalado y verificado. Sin cambios en MySQL.' -ForegroundColor Green
  Write-Host "Respaldo de archivos: $respaldo"
  Write-Host 'Aun falta la migracion MySQL aditiva para activar subpreparaciones.'
  Write-Host 'Antes de ejecutarla EXPORTA una copia completa de tu base en MySQL Workbench.'
  Write-Host 'Vista previa: node --env-file=.env scripts/migrate-dough-preparations.js'
  Write-Host 'Tras el respaldo: node --env-file=.env scripts/migrate-dough-preparations.js --apply --confirm-backup'
} catch {
  foreach ($archivo in $anteriores) {
    Copy-Item -LiteralPath (Join-Path $respaldo $archivo) -Destination (Join-Path $Destino $archivo) -Force
  }
  foreach ($archivo in $nuevos) {
    Remove-Item -LiteralPath (Join-Path $Destino $archivo) -Force -ErrorAction SilentlyContinue
  }
  throw
}
