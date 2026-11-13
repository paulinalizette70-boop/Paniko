# Paniko 0.7.0 - Redisenio de interfaz. No modifica MySQL ni recetas privadas.
param([string]$Destino = 'D:\Paniko-main\Paniko-main')
$ErrorActionPreference = 'Stop'
try {
    $Origen = (Resolve-Path -LiteralPath $PSScriptRoot).Path
    if (-not (Test-Path -LiteralPath $Destino -PathType Container)) {
        throw "No existe la carpeta de Paniko: $Destino"
    }
    $Destino = (Resolve-Path -LiteralPath $Destino).Path
    if ($Origen -eq $Destino) { throw 'Abre el parche desde una carpeta diferente al programa.' }

    foreach ($Requerido in @('server.js','src\finished-products.js','public\products.js','package.json','.env')) {
        if (-not (Test-Path -LiteralPath (Join-Path $Destino $Requerido) -PathType Leaf)) {
            throw "Falta $Requerido. Comprueba que estas usando tu Paniko con MySQL."
        }
    }

    $VersionActual = Get-Content -LiteralPath (Join-Path $Destino 'package.json') -Raw | ConvertFrom-Json
    if ($VersionActual.name -ne 'paniko' -or $VersionActual.version -ne '0.6.3') {
        throw "Este parche requiere Paniko 0.6.3. Version actual: $($VersionActual.version). No se hicieron cambios."
    }
    $VersionNueva = Get-Content -LiteralPath (Join-Path $Origen 'package.json') -Raw | ConvertFrom-Json
    if ($VersionNueva.version -ne '0.7.0') { throw 'El paquete de actualizacion no corresponde a 0.7.0.' }

    $Archivos = @(
        'public\index.html', 'public\styles.css', 'public\app.js', 'public\products.js',
        'tests\ui-redesign.test.js', 'package.json', 'package-lock.json', 'README.md'
    )
    foreach ($Relativo in $Archivos) {
        if (-not (Test-Path -LiteralPath (Join-Path $Origen $Relativo) -PathType Leaf)) {
            throw "El parche esta incompleto: falta $Relativo"
        }
    }

    $Respaldo = Join-Path (Split-Path -Parent $Destino) ('Paniko_respaldo_codigo_070_' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Write-Host "Programa: $Destino"
    Write-Host "Respaldo de codigo: $Respaldo"
    Write-Host 'Solo se actualizaran archivos de interfaz, pruebas y version.'
    Write-Host 'No se tocaran .env, private, datos, contrasenas, MySQL ni recetas privadas.'
    $Confirmacion = Read-Host 'Escribe ACTUALIZAR para instalar Paniko 0.7.0, o Enter para cancelar'
    if ($Confirmacion -cne 'ACTUALIZAR') { Write-Host 'Actualizacion cancelada. No se hicieron cambios.'; exit 0 }

    $Existentes = @()
    $Nuevos = @()
    foreach ($Relativo in $Archivos) {
        $ArchivoOriginal = Join-Path $Destino $Relativo
        if (Test-Path -LiteralPath $ArchivoOriginal -PathType Leaf) {
            $Existentes += $Relativo
            $Copia = Join-Path $Respaldo $Relativo
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Copia) | Out-Null
            Copy-Item -LiteralPath $ArchivoOriginal -Destination $Copia -Force
        } else {
            $Nuevos += $Relativo
        }
    }
    Write-Host 'Respaldo de archivos existentes completado.'

    try {
        foreach ($Relativo in $Archivos) {
            $DestinoArchivo = Join-Path $Destino $Relativo
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $DestinoArchivo) | Out-Null
            Copy-Item -LiteralPath (Join-Path $Origen $Relativo) -Destination $DestinoArchivo -Force
            Write-Host "Actualizado: $Relativo"
        }
    } catch {
        $ErrorOriginal = $_.Exception.Message
        foreach ($Relativo in $Existentes) {
            Copy-Item -LiteralPath (Join-Path $Respaldo $Relativo) -Destination (Join-Path $Destino $Relativo) -Force
        }
        foreach ($Relativo in $Nuevos) {
            $Nuevo = Join-Path $Destino $Relativo
            if (Test-Path -LiteralPath $Nuevo -PathType Leaf) { Remove-Item -LiteralPath $Nuevo -Force }
        }
        throw "No se pudo completar la instalacion. Codigo restaurado desde respaldo. Detalle: $ErrorOriginal"
    }
    Write-Host 'Paniko 0.7.0 instalado. Vuelve a abrir el servidor y ejecuta npm.cmd test.' -ForegroundColor Green
    Write-Host "Respaldo: $Respaldo"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
