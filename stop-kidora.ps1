# ==================================================================
#  KIDORA - Arret local Windows
#
#  Arrete PostgreSQL. Les serveurs npm run dev s'arretent avec Ctrl+C
#  dans leur fenetre, ou en fermant cette fenetre.
# ==================================================================

$tools = Join-Path $env:LOCALAPPDATA "kidora-tools"

& "$tools\pgsql\bin\pg_ctl.exe" -D "$tools\pgdata" stop
Write-Host "PostgreSQL arrete. (Ctrl+C dans la fenetre du dev pour l'API/web.)" -ForegroundColor Green
