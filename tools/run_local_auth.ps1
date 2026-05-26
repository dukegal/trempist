# Start TCP auth server locally (port 9000) using .env from repo root.
# Requires DATABASE_URL + SECRET_KEY to match Render so JWT works on production API.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path ".env")) {
    Write-Host "Create .env from .env.example (same DATABASE_URL and SECRET_KEY as Render)." -ForegroundColor Yellow
    exit 1
}
Write-Host "Starting auth server on 127.0.0.1:9000 (Ctrl+C to stop)..." -ForegroundColor Cyan
py -m app.auth_socket_server
