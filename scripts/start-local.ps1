$ErrorActionPreference = 'Stop'
$projectPath = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectPath
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) { python -m venv .venv }
& '.\.venv\Scripts\python.exe' -m pip install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
& '.\.venv\Scripts\python.exe' -m backend.app.cli init
if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
Push-Location frontend
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
Pop-Location
$backendProcess = Start-Process -FilePath "$projectPath\.venv\Scripts\python.exe" -ArgumentList '-m','uvicorn','backend.app.main:app','--host','127.0.0.1','--port','18080' -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru
try {
    $env:API_URL = 'http://127.0.0.1:18080'
    $env:PORT = '3100'
    Write-Host 'Open http://localhost:3100 in your browser. Press Ctrl+C here to stop.'
    Push-Location frontend
    npm.cmd run start
} finally {
    Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue
    Pop-Location
}
