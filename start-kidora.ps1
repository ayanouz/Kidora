# ==================================================================
#  KIDORA - Demarrage local Windows (installation portable, sans admin)
#
#  Prerequis deja installes sur ce PC :
#    %LOCALAPPDATA%\kidora-tools\node   -> Node.js 24 LTS
#    %LOCALAPPDATA%\kidora-tools\pgsql  -> PostgreSQL 16
#    %LOCALAPPDATA%\kidora-tools\pgdata -> base de donnees "kidora"
#
#  Usage :
#    powershell -ExecutionPolicy Bypass -File .\start-kidora.ps1
#  (ou double-clic sur le raccourci du bureau "Lancer Kidora")
# ==================================================================

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tools = Join-Path $env:LOCALAPPDATA "kidora-tools"
$env:PATH = "$tools\node;$tools\pgsql\bin;$env:PATH"

Write-Host ""
Write-Host "  KIDORA - demarrage" -ForegroundColor Magenta
Write-Host "  ------------------" -ForegroundColor DarkGray

# 1) PostgreSQL (demarre si necessaire)
& "$tools\pgsql\bin\pg_isready.exe" -h localhost -p 5432 *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "  PostgreSQL : demarrage..." -ForegroundColor Cyan
  & "$tools\pgsql\bin\pg_ctl.exe" -D "$tools\pgdata" -l "$tools\pgdata\server.log" start
} else {
  Write-Host "  PostgreSQL : deja en cours." -ForegroundColor Green
}

# 2) Ouvrir le navigateur dans quelques secondes
Start-Job -ScriptBlock {
  Start-Sleep -Seconds 8
  Start-Process "http://localhost:5173"
} | Out-Null

# 3) API + frontend (Ctrl+C pour arreter)
Write-Host "  Application : http://localhost:5173 (Ctrl+C pour arreter)" -ForegroundColor Cyan
Set-Location $root
& "$tools\node\npm.cmd" run dev
