param([switch]$SkipBuild, [int]$Port = 5000)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path .venv/Scripts/python.exe)) { python -m venv .venv }
$pythonPath = Join-Path (Get-Location) '.venv/Scripts/python.exe'
& $pythonPath -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
if (-not (Test-Path .env)) {
    $randomSecret = & $pythonPath -c 'import secrets; print(secrets.token_hex(32))'
    (Get-Content .env.example -Raw).Replace('replace-with-at-least-32-random-characters', $randomSecret) | Set-Content .env
}
if (-not $SkipBuild) {
    Push-Location client
    try {
        $flutterBin = Split-Path (Get-Command flutter).Source
        $dartPath = Join-Path $flutterBin 'cache/dart-sdk/bin/dart.exe'
        $snapshotPath = Join-Path $flutterBin 'cache/flutter_tools.snapshot'
        & $dartPath $snapshotPath pub get
        if ($LASTEXITCODE -ne 0) { throw 'Flutter package resolution failed' }
        & $dartPath $snapshotPath build web --release --no-web-resources-cdn
        if ($LASTEXITCODE -ne 0) { throw 'Flutter web build failed' }
    } finally { Pop-Location }
}
& $pythonPath -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed' }
Write-Host "SHK Connect: http://localhost:$Port"
& $pythonPath -m uvicorn backend.app.main:app --host 127.0.0.1 --port $Port
