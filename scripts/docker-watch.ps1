Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host 'Starting Docker Compose in watch mode...' -ForegroundColor Cyan
docker compose up -d
 $migrationFlag = Join-Path $PSScriptRoot '.db-migrate.done'
 if (-not (Test-Path $migrationFlag)) {
 	Write-Host 'Running initial db:migrate...' -ForegroundColor Cyan
 	docker compose exec api npm run db:migrate
 	New-Item -Path $migrationFlag -ItemType File -Force | Out-Null
 }
Write-Host 'Streaming Docker Compose logs (follow)...' -ForegroundColor Cyan
Start-Process -NoNewWindow -FilePath 'docker' -ArgumentList 'compose', 'logs', '-f', '--timestamps' | Out-Null
docker compose watch --verbose
