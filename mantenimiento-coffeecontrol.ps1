param(
    [ValidateSet('menu', 'doctor', 'backup', 'purge', 'restore', 'rebuild')]
    [string]$Action = 'menu',
    [string]$InputPath = '',
    [switch]$Recreate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = $PSScriptRoot
$BackendRoot = Join-Path $RepoRoot 'backend'
$BackupRoot = Join-Path $RepoRoot 'backups\db'
$NpmCmd = 'npm.cmd'
$NodeCmd = 'node'

function Write-Title {
    param([string]$Text)
    Write-Host ''
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ('=' * $Text.Length) -ForegroundColor DarkCyan
}

function Write-InfoLine {
    param(
        [string]$Label,
        [string]$Value,
        [ConsoleColor]$ValueColor = [ConsoleColor]::Gray
    )
    Write-Host ("{0,-10}: " -f $Label) -NoNewline -ForegroundColor DarkGray
    Write-Host $Value -ForegroundColor $ValueColor
}

function Write-WarningBlock {
    param([string[]]$Lines)
    Write-Host ''
    foreach ($line in $Lines) {
        Write-Host "  ! $line" -ForegroundColor Yellow
    }
}

function Get-EnvFileValue {
    param([string]$Name)
    $envPath = Join-Path $BackendRoot '.env'
    if (-not (Test-Path $envPath)) { return '' }
    $line = Get-Content $envPath | Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } | Select-Object -First 1
    if (-not $line) { return '' }
    return ($line -replace "^\s*$([regex]::Escape($Name))\s*=\s*", '').Trim()
}

function Get-DatabaseUrl {
    if ($env:DATABASE_URL) { return $env:DATABASE_URL }
    $value = Get-EnvFileValue -Name 'DATABASE_URL'
    if ($value) { return $value }
    throw "No se encontro DATABASE_URL en el entorno ni en backend\.env"
}

function Get-DatabaseName {
    $dbUrl = Get-DatabaseUrl
    $uri = [Uri]$dbUrl
    return [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
}

function Get-RecentBackups {
    if (-not (Test-Path $BackupRoot)) { return @() }
    return @(Get-ChildItem -LiteralPath $BackupRoot -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 3)
}

function Resolve-BackupPathOrThrow {
    param([string]$PathArg)

    if (-not $PathArg) {
        throw 'No se indicó una ruta de backup.'
    }
    if (-not (Test-Path -LiteralPath $PathArg)) {
        throw "No existe el archivo indicado: $PathArg"
    }
    return (Resolve-Path -LiteralPath $PathArg).Path
}

function Invoke-Backend {
    param(
        [Parameter(Mandatory=$true)][string]$FileOrCmd,
        [string[]]$Args = @(),
        [switch]$UseNpm
    )

    Push-Location $BackendRoot
    try {
        if ($UseNpm) {
            & $NpmCmd $FileOrCmd @Args
        } else {
            & $NodeCmd $FileOrCmd @Args
        }
        if ($LASTEXITCODE -ne 0) {
            throw "El comando termino con codigo $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Pause-Menu {
    Write-Host ''
    Read-Host 'Presiona Enter para volver al menu'
}

function Confirm-YesNo {
    param([string]$Prompt)
    $answer = Read-Host "$Prompt (s/N)"
    return $answer -match '^(s|si|y|yes)$'
}

function Confirm-Typed {
    param(
        [string]$Prompt,
        [string]$Expected
    )
    $answer = Read-Host "$Prompt [$Expected]"
    return $answer -eq $Expected
}

function Run-Doctor {
    Write-Title 'Doctor del sistema'
    Invoke-Backend -FileOrCmd 'run' -Args @('support:doctor') -UseNpm
}

function Run-Backup {
    Write-Title 'Backup logico'
    Write-Host 'Se generara un backup logico de la base configurada en backend/.env.' -ForegroundColor Gray
    Invoke-Backend -FileOrCmd 'run' -Args @('db:backup') -UseNpm
}

function Run-Purge {
    Write-Title 'Purga operativa'
    Write-WarningBlock @(
        'Borra datos operativos y transaccionales.'
        'No borra empleados, TAGs, maquinas, jerarquias, usuarios ni stock configurado.'
        'Conviene hacer un backup antes.'
    )
    Write-Host ''
    Write-Host 'Vista previa de la purga operativa:' -ForegroundColor Cyan
    Invoke-Backend -FileOrCmd 'scripts/db-purge.js' -Args @('--dry-run')
    if (-not (Confirm-YesNo 'Ejecutar la purga real?')) { return }
    Invoke-Backend -FileOrCmd 'scripts/db-purge.js' -Args @('--yes')
}

function Run-Restore {
    param([string]$PathArg = '', [bool]$RecreateDb = $false)

    $backupPath = $PathArg
    if (-not $backupPath) {
        $backupPath = Read-Host 'Ruta del backup (.sql o .dump)'
    }
    if (-not $backupPath) { return }

    $resolved = Resolve-BackupPathOrThrow -PathArg $backupPath
    $args = @('--input', $resolved)
    if ($RecreateDb) {
        $dbName = Get-DatabaseName
        $args += @('--recreate', '--confirm', $dbName)
    }

    if ($RecreateDb) {
        Write-Title 'Restore recreando base'
        Write-WarningBlock @(
            'Se eliminara y recreara la base antes de restaurar.'
            'Usa esta opcion solo si queres volver a un estado exacto del backup.'
        )
    } else {
        Write-Title 'Restore sobre base actual'
        Write-WarningBlock @(
            'Se intentara cargar el backup sobre la base configurada actualmente.'
            'Si la base tiene datos previos, revisa primero la vista previa.'
        )
    }

    Write-Host ''
    Write-Host 'Vista previa de restore:' -ForegroundColor Cyan
    Invoke-Backend -FileOrCmd 'scripts/db-restore.js' -Args ($args + @('--dry-run'))
    if (-not (Confirm-Typed -Prompt 'Para restaurar escribi' -Expected 'RESTORE')) { return }
    Invoke-Backend -FileOrCmd 'scripts/db-restore.js' -Args ($args + @('--yes'))
}

function Run-Rebuild {
    $dbName = Get-DatabaseName
    Write-Title 'Rebuild completo'
    Write-WarningBlock @(
        'Esta accion es destructiva.'
        "Borra y recrea la base '$dbName'."
        'Luego aplica schema.sql y las migraciones faltantes del repo.'
    )
    Write-Host ''
    Write-Host 'Vista previa de rebuild:' -ForegroundColor Cyan
    Invoke-Backend -FileOrCmd 'scripts/db-rebuild.js' -Args @('--dry-run')
    if (-not (Confirm-Typed -Prompt 'Para reconstruir la base escribi el nombre exacto' -Expected $dbName)) { return }
    Invoke-Backend -FileOrCmd 'scripts/db-rebuild.js' -Args @('--confirm', $dbName)
}

function Show-QuickHelp {
    Write-Title 'Ayuda rapida'
    Write-Host 'Este menu usa la configuracion actual de backend/.env.' -ForegroundColor Gray
    Write-Host ''
    Write-Host 'Recomendacion de uso:' -ForegroundColor Cyan
    Write-Host '  1. Doctor  -> valida entorno, DB, SMTP y /health'
    Write-Host '  2. Backup  -> genera un respaldo antes de tocar algo'
    Write-Host '  3. Purge   -> limpia operacion sin destruir estructura ni maestros'
    Write-Host '  4. Restore -> vuelve a un backup'
    Write-Host '  5. Rebuild -> reconstruye una base desde cero'
    Write-Host ''
    Write-Host 'Regla practica:' -ForegroundColor Cyan
    Write-Host '  Si vas a tocar algo delicado, hace primero Backup.'
    Write-Host '  Si queres validar una instalacion, usa Doctor.'
    Write-Host ''
    Write-Host 'Tambien podes ejecutarlo directo por comando:' -ForegroundColor Cyan
    Write-Host '  .\mantenimiento-coffeecontrol.bat -Action doctor'
    Write-Host '  .\mantenimiento-coffeecontrol.ps1 -Action backup'
}

function Show-MenuHeader {
    $dbName = Get-DatabaseName
    $recentBackups = Get-RecentBackups

    Clear-Host
    Write-Title 'CoffeeControl - Mantenimiento'
    Write-InfoLine -Label 'Repo' -Value $RepoRoot
    Write-InfoLine -Label 'Backend' -Value $BackendRoot
    Write-InfoLine -Label 'Base' -Value $dbName -ValueColor Cyan
    Write-InfoLine -Label 'Backups' -Value $BackupRoot
    Write-Host ''

    if ($recentBackups.Count -gt 0) {
        Write-Host 'Ultimos backups:' -ForegroundColor Cyan
        foreach ($backup in $recentBackups) {
            $sizeKb = [math]::Round($backup.Length / 1KB, 1)
            Write-Host ("  - {0}  ({1} KB, {2})" -f $backup.Name, $sizeKb, $backup.LastWriteTime.ToString('dd/MM/yyyy HH:mm'))
        }
    } else {
        Write-Host 'Ultimos backups: todavia no hay backups en la carpeta del repo.' -ForegroundColor DarkYellow
    }

    Write-Host ''
    Write-Host 'Opciones:' -ForegroundColor Cyan
    Write-Host '  1. Doctor' -ForegroundColor Green
    Write-Host '     Verifica .env, PostgreSQL, SMTP y /health.'
    Write-Host '  2. Backup' -ForegroundColor Green
    Write-Host '     Genera un respaldo logico de la base actual.'
    Write-Host '  3. Purge operativa' -ForegroundColor Yellow
    Write-Host '     Limpia taps, alertas, auditoria, comandos y telemetria dinamica.'
    Write-Host '  4. Restore backup' -ForegroundColor Yellow
    Write-Host '     Restaura un backup sobre la base actual.'
    Write-Host '  5. Restore recreando base' -ForegroundColor DarkYellow
    Write-Host '     Drop/create de la base y luego restore del backup indicado.'
    Write-Host '  6. Rebuild completo' -ForegroundColor Red
    Write-Host '     Reconstruye la base desde schema.sql + migraciones.'
    Write-Host '  7. Ayuda rapida' -ForegroundColor Gray
    Write-Host '  0. Salir' -ForegroundColor Gray
    Write-Host ''
}

function Show-Menu {
    while ($true) {
        Show-MenuHeader

        try {
            switch ((Read-Host 'Elegi una opcion').Trim().ToLowerInvariant()) {
            '1' { Run-Doctor; Pause-Menu }
            '2' { Run-Backup; Pause-Menu }
            '3' { Run-Purge; Pause-Menu }
            '4' { Run-Restore; Pause-Menu }
            '5' { Run-Restore -RecreateDb $true; Pause-Menu }
            '6' { Run-Rebuild; Pause-Menu }
            '7' { Show-QuickHelp; Pause-Menu }
            'h' { Show-QuickHelp; Pause-Menu }
            '0' { return }
            default { Write-Host 'Opcion invalida' -ForegroundColor Yellow; Start-Sleep -Seconds 1 }
            }
        } catch {
            Write-Host ''
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
            Pause-Menu
        }
    }
}

try {
    switch ($Action) {
        'menu'    { Show-Menu }
        'doctor'  { Run-Doctor }
        'backup'  { Run-Backup }
        'purge'   { Run-Purge }
        'restore' { Run-Restore -PathArg $InputPath -RecreateDb ([bool]$Recreate) }
        'rebuild' { Run-Rebuild }
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
