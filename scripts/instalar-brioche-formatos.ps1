param([string]$Destino = 'D:\Paniko-main\Paniko-main')
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path -LiteralPath (Join-Path $Destino '.env'))) {
  throw 'No se encontro .env. No se modifico nada.'
}
if (-not (Test-Path -LiteralPath (Join-Path $Destino 'server.js'))) {
  throw 'No se encontro la instalacion de Paniko. No se modifico nada.'
}
$version = (Get-Content -LiteralPath (Join-Path $Destino 'package.json') -Raw | ConvertFrom-Json).version
if ($version -ne '0.8.3') {
  throw "Esta mejora se preparo para Paniko 0.8.3. Version encontrada: $version. No se modifico nada."
}
if (-not (Test-Path -LiteralPath (Join-Path $Destino 'public\starter-status.js'))) {
  throw 'Primero debe estar instalado el panel visual de masa madre. No se modifico nada.'
}

# Solo archivos que cambia el PR de brioche. No sobrescribe recetas, .env, private/, ni otros modulos.
$archivos = @(
  'server.js',
  'src\app.js',
  'src\mysql-store.js',
  'src\dough-formats.js',
  'sql\dough-formats.sql',
  'sql\finished-products.sql',
  'scripts\init-db.js',
  'scripts\migrate-dough-formats.js',
  'public\index.html',
  'public\dough.js',
  'public\app.js',
  'public\styles.css',
  'tests\dough-formats.test.js',
  'tests\mysql-dough-formats.test.js',
  'docs\releases\Paniko-brioche-formatos.md'
)
foreach ($archivo in $archivos) {
  if (-not (Test-Path -LiteralPath (Join-Path $raiz $archivo))) {
    throw "Paquete incompleto: $archivo. No se modifico nada."
  }
}
Write-Host 'Paniko: produccion por formatos de brioche'
Write-Host "Instalacion: $Destino (version $version)"
Write-Host 'Se respaldara solo el codigo que se reemplace.'
Write-Host 'Esta instalacion NO ejecuta migraciones ni cambia datos MySQL.'
Write-Warning 'Cierra Paniko antes de continuar. Necesitaras respaldo de MySQL para habilitar los formatos.'
$confirm = Read-Host 'Escribe ACTUALIZAR para copiar el codigo, o Enter para cancelar'
if ($confirm -cne 'ACTUALIZAR') {
  Write-Host 'Cancelado. No se modifico nada.'
  exit 0
}

$respaldo = Join-Path (Split-Path -Parent $Destino) ('Respaldo_Brioche_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$existian = @()
$nuevos = @()
foreach ($archivo in $archivos) {
  $actual = Join-Path $Destino $archivo
  if (Test-Path -LiteralPath $actual) {
    $copia = Join-Path $respaldo $archivo
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $copia) | Out-Null
    Copy-Item -LiteralPath $actual -Destination $copia -Force
    $existian += $archivo
  } else {
    $nuevos += $archivo
  }
}
try {
  foreach ($archivo in $archivos) {
    $actual = Join-Path $Destino $archivo
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $actual) | Out-Null
    Copy-Item -LiteralPath (Join-Path $raiz $archivo) -Destination $actual -Force
  }
  $pagina = Get-Content -LiteralPath (Join-Path $Destino 'public\index.html') -Raw
  $app = Get-Content -LiteralPath (Join-Path $Destino 'public\app.js') -Raw
  if (-not $pagina.Contains('Brioche y formatos') -or -not $pagina.Contains('Abrir producción por formatos') -or -not $app.Contains('scrollTo:button.dataset.scrollTo||null')) {
    throw 'Verificacion fallida: no aparecio el acceso visible de brioche. Se restaurara el codigo.'
  }
  Write-Host 'Verificacion OK: Brioche y formatos esta en el menu y en Produccion.' -ForegroundColor Green
  Write-Host 'Reinicia el servidor y usa Ctrl+F5 en el navegador.'
  Write-Host 'Si el panel muestra error de datos, verifica primero la migracion MySQL.'
  Write-Host 'Codigo de produccion por formatos instalado.' -ForegroundColor Green
  Write-Host "Respaldo del codigo: $respaldo"
  Write-Host 'IMPORTANTE: Falta aplicar la migracion MySQL despues de exportar un respaldo.'
  Write-Host 'Vista previa: node --env-file=.env scripts/migrate-dough-formats.js'
  Write-Host 'Aplicar (tras respaldo): node --env-file=.env scripts/migrate-dough-formats.js --apply --confirm-backup'
} catch {
  foreach ($archivo in $existian) {
    Copy-Item -LiteralPath (Join-Path $respaldo $archivo) -Destination (Join-Path $Destino $archivo) -Force
  }
  foreach ($archivo in $nuevos) {
    Remove-Item -LiteralPath (Join-Path $Destino $archivo) -Force -ErrorAction SilentlyContinue
  }
  throw
}
